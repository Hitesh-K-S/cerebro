/**
 * Cerebro — Sequence Recall Game Engine
 */

'use strict';

var SequenceRecall = (function ($) {

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        STUDY: 'STUDY',
        INPUT: 'INPUT',
        FEEDBACK: 'FEEDBACK',
        GAME_OVER: 'GAME_OVER'
    };

    var COUNTDOWN_SECONDS = 3;
    var TOTAL_ROUNDS = 6;
    var STUDY_MS = 2400;
    var FEEDBACK_MS = 900;

    var state = STATES.INIT;
    var level = 1, round = 1, score = 0, lives = 3;
    var sessionToken = null, gameTimer = null;
    var currentRound = null, chosen = [];
    var correctCount = 0, wrongCount = 0, bestStreak = 0, streak = 0;
    var roundData = [], timeouts = [], countdownIntervalId = null, inputStartMs = 0;
    var $board, $statusText, $startScreen, $displayLevel, $displayRound, $displayScore, $displayLives;

    function cacheDom() {
        $board = $('#game-board');
        $statusText = $('#status-text');
        $startScreen = $('#game-start-screen');
        $displayLevel = $('#display-level');
        $displayRound = $('#display-round');
        $displayScore = $('#display-score');
        $displayLives = $('#display-lives');
    }

    function schedule(fn, ms) {
        var id = setTimeout(fn, ms);
        timeouts.push(id);
        return id;
    }

    function clearTimers() {
        while (timeouts.length) clearTimeout(timeouts.pop());
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
    }

    function init() {
        cacheDom();
        bindEvents();
        state = STATES.INIT;
    }

    function resetGame() {
        clearTimers();
        state = STATES.INIT;
        level = 1; round = 1; score = 0; lives = 3;
        sessionToken = null; currentRound = null; chosen = [];
        correctCount = 0; wrongCount = 0; bestStreak = 0; streak = 0;
        roundData = []; inputStartMs = 0;
        if (gameTimer) gameTimer.reset();
    }

    function sequenceLength() {
        return Math.min(4 + Math.floor((level - 1) / 2), 7);
    }

    function renderFrame() {
        $board.empty().removeClass().addClass('game-board sequence-recall-board');
        $board.html('<div class="sr-shell"><div class="sr-stage" id="sr-stage"></div></div>');
    }

    function runCountdown() {
        var count = COUNTDOWN_SECONDS;
        $('#countdown-overlay').removeClass('hidden');
        $('#countdown-number').text(count);
        countdownIntervalId = setInterval(function () {
            count--;
            if (count > 0) $('#countdown-number').text(count);
            else {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
                $('#countdown-overlay').addClass('hidden');
                startRound();
            }
        }, 1000);
    }

    function startRound() {
        currentRound = CerebroMemoryContent.getSequenceRound(sequenceLength());
        chosen = [];
        state = STATES.STUDY;
        setStatus('Study the order carefully. You will rebuild it from memory.', 'watching');
        renderStudy();
        updateDisplay();
        schedule(beginInput, Math.max(1600, STUDY_MS - (level - 1) * 120));
    }

    function renderStudy() {
        var html = '<div class="sr-study">';
        html += '<span class="sr-kicker">' + escapeHtml(currentRound.label) + ' Sequence</span>';
        html += '<div class="sr-sequence-row">';
        currentRound.sequence.forEach(function (token, index) {
            html += '<div class="sr-token-card"><span class="sr-token-index">' + (index + 1) + '</span><strong>' + escapeHtml(token) + '</strong></div>';
        });
        html += '</div></div>';
        $('#sr-stage').html(html);
    }

    function beginInput() {
        state = STATES.INPUT;
        inputStartMs = gameTimer ? gameTimer.getElapsedMs() : 0;
        setStatus('Rebuild the sequence in the exact same order.', 'your-turn');
        renderInput();
    }

    function renderInput() {
        var html = '<div class="sr-input">';
        html += '<div class="sr-memory-row"><span class="sr-kicker">Your sequence</span><div class="sr-picked-row">';
        if (!chosen.length) html += '<span class="sr-placeholder">Tap each token in order</span>';
        chosen.forEach(function (token) {
            html += '<span class="sr-picked-token">' + escapeHtml(token) + '</span>';
        });
        html += '</div></div>';
        html += '<div class="sr-options-grid">';
        currentRound.options.forEach(function (token) {
            var disabled = chosen.indexOf(token) !== -1 ? ' disabled' : '';
            html += '<button class="sr-option-btn" data-token="' + escapeHtml(token) + '" type="button"' + disabled + '>' + escapeHtml(token) + '</button>';
        });
        html += '</div><button class="sr-reset-btn" id="sr-reset-btn" type="button">Reset Sequence</button></div>';
        $('#sr-stage').html(html);
    }

    function pickToken(token) {
        if (state !== STATES.INPUT || chosen.indexOf(token) !== -1) return;
        chosen.push(token);
        if (window.CerebroSound) CerebroSound.tap();
        if (chosen.length >= currentRound.sequence.length) finishRound();
        else renderInput();
    }

    function resetChosen() {
        if (state !== STATES.INPUT) return;
        chosen = [];
        renderInput();
    }

    function finishRound() {
        state = STATES.FEEDBACK;
        var correct = currentRound.sequence.every(function (token, index) { return chosen[index] === token; });
        var reaction = gameTimer ? Math.max(0, gameTimer.getElapsedMs() - inputStartMs) : 0;
        var points = 0;
        if (correct) {
            correctCount++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            points = 110 + (level * 18) + Math.max(0, 70 - Math.floor(reaction / 35));
            score += points;
            if (round % 2 === 0) level++;
            if (window.CerebroSound) CerebroSound.correct();
            setStatus('Correct. The full order held.', 'correct');
        } else {
            wrongCount++;
            lives--;
            streak = 0;
            if (wrongCount % 2 === 0 && level > 1) level--;
            if (window.CerebroSound) CerebroSound.wrong();
            setStatus('Missed sequence. Focus on grouping and rhythm.', 'wrong');
        }
        roundData.push({ sequence: currentRound.sequence.join(','), correct: correct, reaction_ms: reaction });
        $('#sr-stage').html('<div class="sr-feedback-card ' + (correct ? 'is-correct' : 'is-wrong') + '"><span class="sr-kicker">Correct order</span><h3>' + escapeHtml(currentRound.sequence.join('  ')) + '</h3></div>');
        updateDisplay();
        schedule(function () {
            round++;
            if (round > TOTAL_ROUNDS || lives <= 0) endGame();
            else startRound();
        }, FEEDBACK_MS);
    }

    function endGame() {
        state = STATES.GAME_OVER;
        gameTimer.stop();
        var total = correctCount + wrongCount;
        var acc = total ? Math.round((correctCount / total) * 100) : 0;
        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + TOTAL_ROUNDS + ' sequences');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(acc >= 80 ? 'Sequence Memory Locked' : acc >= 60 ? 'Sequence Recall Improving' : 'Keep Training Order Recall');
        $('#result-badge').addClass('hidden');
        if (window.CerebroSound) CerebroSound.complete();
        if (window.CerebroApp && CerebroApp.animateScore) CerebroApp.animateScore(score); else $('#result-score').text(score);
        if (window.CerebroApp && CerebroApp.setTierBadge) CerebroApp.setTierBadge(score);
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) CerebroApp.updatePerformanceMeters({ accuracy: acc, reaction: averageReaction(), streak: bestStreak });
        $('#modal-gameover').removeClass('hidden');
        if (sessionToken) {
            var payload = {
                token: sessionToken,
                score: score,
                level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: { rounds: roundData.map(function (entry) { return { sequence: [entry.sequence], input: [entry.correct ? 1 : 0], time_ms: entry.reaction_ms }; }) },
                accuracy: acc
            };
            CerebroAPI.post('/game/end', payload).fail(function () { CerebroAPI.queueForRetry('POST', '/game/end', payload); });
        }
    }

    function averageReaction() {
        var values = roundData.filter(function (entry) { return entry.correct; }).map(function (entry) { return entry.reaction_ms; });
        if (!values.length) return 0;
        return Math.round(values.reduce(function (sum, value) { return sum + value; }, 0) / values.length);
    }

    function updateLives() {
        var html = '';
        for (var i = 0; i < 3; i++) html += '<span class="heart">' + (i < lives ? '♥' : '♡') + '</span>';
        $displayLives.html(html);
    }

    function updateDisplay() {
        $displayLevel.text('Lv.' + level);
        $displayRound.text('R' + round + '/' + TOTAL_ROUNDS);
        $displayScore.text(score);
        updateLives();
    }

    function setStatus(text, cls) {
        var $status = $('#game-status');
        $status.removeClass('watching your-turn correct wrong');
        if (cls) $status.addClass(cls);
        $statusText.text(text);
    }

    function bindEvents() {
        $(document).off('.sequencerecall');
        $(document).on('click.sequencerecall', '.sr-option-btn', function () { pickToken($(this).data('token')); });
        $(document).on('click.sequencerecall', '#sr-reset-btn', resetChosen);
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        renderFrame();
        updateDisplay();
        $startScreen.addClass('hidden');
        CerebroAPI.post('/game/start', { game_slug: 'sequence-recall' }).done(function (response) { sessionToken = response.token; }).fail(function () {});
        runCountdown();
    }

    function cleanup() {
        clearTimers();
        $(document).off('.sequencerecall');
        if ($board) $board.empty().removeClass('sequence-recall-board');
        state = STATES.INIT;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    return { init: init, startGame: startGame, cleanup: cleanup, getState: function () { return { state: state, level: level, round: round, score: score }; }, STATES: STATES };

})(jQuery);
