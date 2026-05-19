/**
 * Cerebro — Mental Stack Game Engine
 */

'use strict';

var MentalStack = (function ($) {

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        STUDY: 'STUDY',
        RECALL: 'RECALL',
        FEEDBACK: 'FEEDBACK',
        GAME_OVER: 'GAME_OVER'
    };

    var COUNTDOWN_SECONDS = 3;
    var TOTAL_ROUNDS = 6;
    var STUDY_MS = 3000;
    var FEEDBACK_MS = 1000;

    var state = STATES.INIT;
    var level = 1, round = 1, score = 0, lives = 3;
    var sessionToken = null, gameTimer = null, currentChallenge = null;
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
        sessionToken = null; currentChallenge = null;
        correctCount = 0; wrongCount = 0; bestStreak = 0; streak = 0;
        roundData = []; inputStartMs = 0;
        if (gameTimer) gameTimer.reset();
    }

    function renderFrame() {
        $board.empty().removeClass().addClass('game-board mental-stack-board');
        $board.html('<div class="ms-shell"><div class="ms-stage" id="ms-stage"></div></div>');
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
        currentChallenge = CerebroMemoryContent.getStackChallenge(level);
        state = STATES.STUDY;
        setStatus('Track the full state as each action changes the system.', 'watching');
        renderStudy();
        updateDisplay();
        schedule(beginRecall, Math.max(1800, STUDY_MS - (level - 1) * 100));
    }

    function renderStudy() {
        var html = '<div class="ms-study">';
        html += '<div class="ms-card"><span class="ms-kicker">Initial State</span><ul class="ms-list">';
        currentChallenge.entities.forEach(function (entity) {
            html += '<li>' + escapeHtml(entity.name + ': ' + (currentChallenge.initial[entity.name] ? entity.on : entity.off)) + '</li>';
        });
        html += '</ul></div>';
        html += '<div class="ms-card"><span class="ms-kicker">Actions</span><ol class="ms-list">';
        currentChallenge.actions.forEach(function (action) {
            html += '<li>' + escapeHtml(CerebroMemoryContent.describeAction(action)) + '</li>';
        });
        html += '</ol></div></div>';
        $('#ms-stage').html(html);
    }

    function beginRecall() {
        state = STATES.RECALL;
        inputStartMs = gameTimer ? gameTimer.getElapsedMs() : 0;
        setStatus('Which final state is correct after all actions?', 'your-turn');
        var html = '<div class="ms-recall"><span class="ms-kicker">Final State Check</span><div class="ms-options">';
        currentChallenge.options.forEach(function (option) {
            html += '<button class="ms-option-btn" data-choice="' + escapeHtml(option) + '" type="button">' + escapeHtml(option) + '</button>';
        });
        html += '</div></div>';
        $('#ms-stage').html(html);
    }

    function answer(choice) {
        if (state !== STATES.RECALL) return;
        state = STATES.FEEDBACK;
        var correct = choice === currentChallenge.correctLabel;
        var reaction = gameTimer ? Math.max(0, gameTimer.getElapsedMs() - inputStartMs) : 0;
        var points = 0;
        if (correct) {
            correctCount++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            points = 150 + (level * 25) + Math.max(0, 80 - Math.floor(reaction / 45));
            score += points;
            if (round % 2 === 0) level++;
            if (window.CerebroSound) CerebroSound.correct();
            setStatus('Correct. You tracked the evolving state cleanly.', 'correct');
        } else {
            wrongCount++;
            lives--;
            streak = 0;
            if (wrongCount % 2 === 0 && level > 1) level--;
            if (window.CerebroSound) CerebroSound.wrong();
            setStatus('Wrong final state. Track each change step by step.', 'wrong');
        }
        roundData.push({ prompt: currentChallenge.correctLabel, correct: correct, reaction_ms: reaction });
        $('#ms-stage').html('<div class="ms-feedback-card ' + (correct ? 'is-correct' : 'is-wrong') + '"><span class="ms-kicker">Correct final state</span><h3>' + escapeHtml(currentChallenge.correctLabel) + '</h3></div>');
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
        $('#result-rounds').text(correctCount + '/' + TOTAL_ROUNDS + ' stacks');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(acc >= 80 ? 'State Tracking Sharp' : acc >= 60 ? 'Mental Stack Improving' : 'Keep Practicing State Tracking');
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
                replay: { rounds: roundData.map(function (entry) { return { sequence: [entry.prompt], input: [entry.correct ? 1 : 0], time_ms: entry.reaction_ms }; }) },
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
        $(document).off('.mentalstack');
        $(document).on('click.mentalstack', '.ms-option-btn', function () { answer($(this).data('choice')); });
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        renderFrame();
        updateDisplay();
        $startScreen.addClass('hidden');
        CerebroAPI.post('/game/start', { game_slug: 'mental-stack' }).done(function (response) { sessionToken = response.token; }).fail(function () {});
        runCountdown();
    }

    function cleanup() {
        clearTimers();
        $(document).off('.mentalstack');
        if ($board) $board.empty().removeClass('mental-stack-board');
        state = STATES.INIT;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    return { init: init, startGame: startGame, cleanup: cleanup, getState: function () { return { state: state, level: level, round: round, score: score }; }, STATES: STATES };

})(jQuery);
