/**
 * Cerebro — Chunking Game Engine
 */

'use strict';

var ChunkingGame = (function ($) {

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        STUDY: 'STUDY',
        REBUILD: 'REBUILD',
        FEEDBACK: 'FEEDBACK',
        GAME_OVER: 'GAME_OVER'
    };

    var COUNTDOWN_SECONDS = 3;
    var TOTAL_ROUNDS = 6;
    var STUDY_MS = 2600;
    var FEEDBACK_MS = 950;

    var state = STATES.INIT;
    var level = 1, round = 1, score = 0, lives = 3;
    var sessionToken = null, gameTimer = null;
    var currentChallenge = null, chosen = [];
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
        sessionToken = null; currentChallenge = null; chosen = [];
        correctCount = 0; wrongCount = 0; bestStreak = 0; streak = 0;
        roundData = []; inputStartMs = 0;
        if (gameTimer) gameTimer.reset();
    }

    function chunkCount() {
        return Math.min(3 + Math.floor((level - 1) / 2), 5);
    }

    function renderFrame() {
        $board.empty().removeClass().addClass('game-board chunking-game-board');
        $board.html('<div class="cg-shell"><div class="cg-stage" id="cg-stage"></div></div>');
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
        currentChallenge = CerebroMemoryContent.getChunkChallenge(chunkCount());
        chosen = [];
        state = STATES.STUDY;
        setStatus('Notice the groups. Remember the chunks, not isolated pieces.', 'watching');
        renderStudy();
        updateDisplay();
        schedule(beginRebuild, Math.max(1700, STUDY_MS - (level - 1) * 120));
    }

    function renderStudy() {
        var html = '<div class="cg-study"><span class="cg-kicker">' + escapeHtml(currentChallenge.label) + '</span><div class="cg-chunk-row">';
        currentChallenge.chunks.forEach(function (chunk) {
            html += '<div class="cg-chunk-card"><strong>' + escapeHtml(chunk) + '</strong></div>';
        });
        html += '</div></div>';
        $('#cg-stage').html(html);
    }

    function beginRebuild() {
        state = STATES.REBUILD;
        inputStartMs = gameTimer ? gameTimer.getElapsedMs() : 0;
        setStatus('Rebuild the grouped chunks in the original order.', 'your-turn');
        renderRebuild();
    }

    function renderRebuild() {
        var html = '<div class="cg-rebuild"><div class="cg-selected"><span class="cg-kicker">Your grouping</span><div class="cg-picked-row">';
        if (!chosen.length) html += '<span class="cg-placeholder">Tap the chunks in order</span>';
        chosen.forEach(function (chunk) { html += '<span class="cg-picked-chip">' + escapeHtml(chunk) + '</span>'; });
        html += '</div></div><div class="cg-options-grid">';
        currentChallenge.options.forEach(function (chunk) {
            var disabled = chosen.indexOf(chunk) !== -1 ? ' disabled' : '';
            html += '<button class="cg-option-btn" data-chunk="' + escapeHtml(chunk) + '" type="button"' + disabled + '>' + escapeHtml(chunk) + '</button>';
        });
        html += '</div><button class="cg-reset-btn" id="cg-reset-btn" type="button">Reset Grouping</button></div>';
        $('#cg-stage').html(html);
    }

    function pickChunk(chunk) {
        if (state !== STATES.REBUILD || chosen.indexOf(chunk) !== -1) return;
        chosen.push(chunk);
        if (window.CerebroSound) CerebroSound.tap();
        if (chosen.length >= currentChallenge.chunks.length) finishRound();
        else renderRebuild();
    }

    function resetChosen() {
        if (state !== STATES.REBUILD) return;
        chosen = [];
        renderRebuild();
    }

    function finishRound() {
        state = STATES.FEEDBACK;
        var correct = currentChallenge.chunks.every(function (chunk, index) { return chosen[index] === chunk; });
        var reaction = gameTimer ? Math.max(0, gameTimer.getElapsedMs() - inputStartMs) : 0;
        var points = 0;
        if (correct) {
            correctCount++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            points = 130 + (currentChallenge.chunks.length * 25) + Math.max(0, 60 - Math.floor(reaction / 50));
            score += points;
            if (round % 2 === 0) level++;
            if (window.CerebroSound) CerebroSound.correct();
            setStatus('Correct grouping. Chunking made recall easier.', 'correct');
        } else {
            wrongCount++;
            lives--;
            streak = 0;
            if (wrongCount % 2 === 0 && level > 1) level--;
            if (window.CerebroSound) CerebroSound.wrong();
            setStatus('Wrong grouping. Try to compress the pattern more clearly.', 'wrong');
        }
        roundData.push({ sequence: currentChallenge.chunks.join(','), correct: correct, reaction_ms: reaction });
        $('#cg-stage').html('<div class="cg-feedback-card ' + (correct ? 'is-correct' : 'is-wrong') + '"><span class="cg-kicker">Correct chunks</span><h3>' + escapeHtml(currentChallenge.chunks.join('  |  ')) + '</h3></div>');
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
        $('#result-rounds').text(correctCount + '/' + TOTAL_ROUNDS + ' chunk sets');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(acc >= 80 ? 'Chunking Working Well' : acc >= 60 ? 'Grouping Recall Improving' : 'Keep Building Better Chunks');
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
        $(document).off('.chunkinggame');
        $(document).on('click.chunkinggame', '.cg-option-btn', function () { pickChunk($(this).data('chunk')); });
        $(document).on('click.chunkinggame', '#cg-reset-btn', resetChosen);
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        renderFrame();
        updateDisplay();
        $startScreen.addClass('hidden');
        CerebroAPI.post('/game/start', { game_slug: 'chunking-game' }).done(function (response) { sessionToken = response.token; }).fail(function () {});
        runCountdown();
    }

    function cleanup() {
        clearTimers();
        $(document).off('.chunkinggame');
        if ($board) $board.empty().removeClass('chunking-game-board');
        state = STATES.INIT;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    return { init: init, startGame: startGame, cleanup: cleanup, getState: function () { return { state: state, level: level, round: round, score: score }; }, STATES: STATES };

})(jQuery);
