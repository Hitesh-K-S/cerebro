/**
 * Cerebro — Flanker Task Game Engine
 *
 * Selective attention: respond to center arrow direction while ignoring flankers.
 */

'use strict';

var FlankerTask = (function ($) {

    var STATES = {
        INIT: 'INIT', COUNTDOWN: 'COUNTDOWN', SHOWING: 'SHOWING',
        INPUT: 'INPUT', FEEDBACK: 'FEEDBACK', GAME_OVER: 'GAME_OVER'
    };

    var BASE_POINTS = 100;
    var COUNTDOWN_SECONDS = 3;
    var FEEDBACK_DELAY = 600;
    var TRIAL_DELAY = 400;

    var DIFFICULTY = [
        { trials: 12, timeout: 2000, incongruentPct: 0.3, label: 'low' },
        { trials: 14, timeout: 1800, incongruentPct: 0.4, label: 'medium' },
        { trials: 16, timeout: 1500, incongruentPct: 0.5, label: 'medium' },
        { trials: 18, timeout: 1200, incongruentPct: 0.6, label: 'high' },
        { trials: 20, timeout: 1000, incongruentPct: 0.7, label: 'high' },
    ];

    var state = STATES.INIT;
    var level = 1, trial = 0, score = 0;
    var correctCount = 0, wrongCount = 0, timeoutCount = 0;
    var totalReaction = 0;
    var currentDirection = '';
    var currentCongruent = true;
    var responded = false;
    var trialTimeoutId = null;
    var showTimeoutId = null;
    var sessionToken = null;
    var gameTimer = null;
    var trialData = [];

    var $board, $countdownOverlay, $countdownNumber;
    var $statusText, $startScreen;
    var $displayLevel, $displayRound, $displayScore;

    function cacheDom() {
        $board = $('#game-board');
        $countdownOverlay = $('#countdown-overlay');
        $countdownNumber = $('#countdown-number');
        $statusText = $('#status-text');
        $startScreen = $('#game-start-screen');
        $displayLevel = $('#display-level');
        $displayRound = $('#display-round');
        $displayScore = $('#display-score');
    }

    function getDifficulty(lvl) {
        return lvl <= DIFFICULTY.length ? DIFFICULTY[lvl - 1] : DIFFICULTY[DIFFICULTY.length - 1];
    }

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
    }

    function setState(newState) {
        state = newState;
        switch (newState) {
            case STATES.COUNTDOWN: runCountdown(); break;
            case STATES.GAME_OVER: endGame(); break;
        }
    }

    function init() { cacheDom(); bindEvents(); state = STATES.INIT; }

    function resetGame() {
        level = 1; trial = 0; score = 0;
        correctCount = 0; wrongCount = 0; timeoutCount = 0;
        totalReaction = 0;
        trialData = []; sessionToken = null;
        clearTimeout(trialTimeoutId); clearTimeout(showTimeoutId);
        if (gameTimer) gameTimer.reset();
    }

    function buildUI() {
        $board.empty().addClass('fk-grid');
        $board.html(
            '<div class="fk-stimulus" id="fk-stimulus">' +
                '<div class="fk-arrows" id="fk-arrows">' +
                    '<span class="fk-arrow" id="fk-a1">→</span>' +
                    '<span class="fk-arrow" id="fk-a2">→</span>' +
                    '<span class="fk-arrow fk-center" id="fk-ac">→</span>' +
                    '<span class="fk-arrow" id="fk-a3">→</span>' +
                    '<span class="fk-arrow" id="fk-a4">→</span>' +
                '</div>' +
            '</div>' +
            '<div class="fk-buttons">' +
                '<button class="fk-btn fk-btn-left" id="fk-left" type="button">' +
                    '<span class="fk-btn-arrow">←</span> Left' +
                    '<span class="fk-key-hint">A / ←</span>' +
                '</button>' +
                '<button class="fk-btn fk-btn-right" id="fk-right" type="button">' +
                    'Right <span class="fk-btn-arrow">→</span>' +
                    '<span class="fk-key-hint">D / →</span>' +
                '</button>' +
            '</div>' +
            '<div class="fk-feedback" id="fk-feedback"></div>' +
            '<div class="fk-progress" id="fk-progress"></div>'
        );
    }

    function updateProgress() {
        var diff = getDifficulty(level);
        var $p = $('#fk-progress');
        $p.empty();
        for (var i = 0; i < diff.trials; i++) {
            var cls = 'fk-dot';
            if (i < trialData.length) cls += trialData[i].correct ? ' correct' : ' wrong';
            if (i === trialData.length) cls += ' current';
            $p.append($('<span>').addClass(cls));
        }
    }

    function runCountdown() {
        var count = COUNTDOWN_SECONDS;
        $startScreen.addClass('hidden');
        $countdownOverlay.removeClass('hidden');
        $countdownNumber.text(count);
        var interval = setInterval(function () {
            count--;
            if (count > 0) { $countdownNumber.text(count); }
            else { clearInterval(interval); $countdownOverlay.addClass('hidden'); startTrial(); }
        }, 1000);
    }

    function generateTrial() {
        var diff = getDifficulty(level);
        currentCongruent = Math.random() > diff.incongruentPct;
        var dirs = ['←', '→'];
        currentDirection = dirs[Math.floor(Math.random() * 2)];
        var flanker = currentCongruent ? currentDirection : (currentDirection === '←' ? '→' : '←');
        return {
            center: currentDirection,
            flankers: flanker,
            congruent: currentCongruent
        };
    }

    function startTrial() {
        var diff = getDifficulty(level);
        var trialInfo = generateTrial();
        responded = false;

        // Update arrow display
        var flanker = trialInfo.flankers;
        $('#fk-a1, #fk-a2, #fk-a3, #fk-a4').text(flanker);
        $('#fk-ac').text(trialInfo.center);

        $('#fk-stimulus').removeClass('correct wrong timeout');
        $('#fk-feedback').text('').removeClass('correct wrong timeout');
        $('#fk-left, #fk-right').prop('disabled', false).removeClass('correct wrong');

        state = STATES.INPUT;
        setStatus(trialInfo.center === '←' ? 'Press ←' : 'Press →', 'your-turn');

        updateDisplay();

        showTimeoutId = setTimeout(function () {
            if (state === STATES.INPUT && !responded) {
                handleTimeout();
            }
        }, diff.timeout);
    }

    function handleResponse(direction) {
        if (state !== STATES.INPUT || responded) return;
        responded = true;
        clearTimeout(showTimeoutId);

        var correct = direction === currentDirection;
        var reactionMs = gameTimer ? gameTimer.getElapsedMs() - trialStartOffset : 0;
        totalReaction += reactionMs;

        if (correct) {
            correctCount++;
            var speedBonus = Math.max(0, Math.round((1000 / Math.max(reactionMs, 1)) * 30));
            var trialScore = BASE_POINTS + speedBonus;
            score += trialScore;
            $('#fk-feedback').text('+' + trialScore).addClass('correct');
            $('#fk-stimulus').addClass('correct');
            if (window.CerebroSound) CerebroSound.correct();
        } else {
            wrongCount++;
            $('#fk-feedback').text('Wrong').addClass('wrong');
            $('#fk-stimulus').addClass('wrong');
            if (window.CerebroSound) CerebroSound.wrong();
        }

        trialData.push({
            center: currentDirection,
            congruent: currentCongruent,
            correct: correct,
            reaction_ms: reactionMs
        });

        $('#fk-left, #fk-right').prop('disabled', true);
        updateDisplay();
        updateProgress();

        trialTimeoutId = setTimeout(function () {
            trial++;
            var diff = getDifficulty(level);
            if (trial >= diff.trials) { setState(STATES.GAME_OVER); }
            else {
                if (trial % 4 === 0 && level < DIFFICULTY.length) level++;
                startTrial();
            }
        }, FEEDBACK_DELAY);
    }

    function handleTimeout() {
        if (responded) return;
        responded = true;
        timeoutCount++;
        wrongCount++;
        $('#fk-feedback').text('Too slow!').addClass('timeout');
        $('#fk-stimulus').addClass('timeout');

        trialData.push({
            center: currentDirection,
            congruent: currentCongruent,
            correct: false,
            reaction_ms: -1
        });

        updateProgress();

        trialTimeoutId = setTimeout(function () {
            trial++;
            var diff = getDifficulty(level);
            if (trial >= diff.trials) { setState(STATES.GAME_OVER); }
            else {
                if (trial % 4 === 0 && level < DIFFICULTY.length) level++;
                startTrial();
            }
        }, FEEDBACK_DELAY);
    }

    var trialStartOffset = 0;

    function endGame() {
        gameTimer.stop();
        setStatus('Session complete', 'wrong');
        var total = correctCount + wrongCount;
        var acc = total > 0 ? Math.round(correctCount / total * 100) : 0;
        var avgReaction = correctCount > 0 ? Math.round(totalReaction / correctCount) : 0;
        var title = acc >= 90 ? 'Sharp Focus' : acc >= 75 ? 'Good Control' : acc >= 60 ? 'Decent Effort' : 'Keep Practicing';

        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + total + ' correct');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(title);
        $('#result-badge').addClass('hidden');

        if (window.CerebroSound) CerebroSound.complete();
        if (window.CerebroApp && CerebroApp.animateScore) CerebroApp.animateScore(score);
        else $('#result-score').text(score);
        if (window.CerebroApp && CerebroApp.setTierBadge) CerebroApp.setTierBadge(score);
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) {
            CerebroApp.updatePerformanceMeters({
                accuracy: acc,
                reaction: avgReaction,
                streak: 0
            });
        }
        if (score > 2000 && window.CerebroApp && CerebroApp.spawnConfetti) CerebroApp.spawnConfetti();
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            var payload = {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: { rounds: trialData.map(function (t) { return { sequence: [t.center + (t.congruent ? '_cong' : '_incong')], input: [t.correct ? 1 : 0], time_ms: t.reaction_ms }; }) },
                accuracy: acc
            };
            CerebroAPI.post('/game/end', payload).fail(function () { CerebroAPI.queueForRetry('POST', '/game/end', payload); });
        }
    }

    function updateDisplay() {
        var diff = getDifficulty(level);
        $displayLevel.text('Lv.' + level);
        $displayRound.text((trial + 1) + '/' + diff.trials);
        $displayScore.text(score);
    }

    function setStatus(text, cls) {
        var $s = $('#game-status');
        $s.removeClass('watching your-turn correct wrong');
        if (cls) $s.addClass(cls);
        $statusText.text(text);
    }

    function bindEvents() {
        $(document).off('.flankertask');
        $(document).on('click.flankertask', '#fk-left', function () { handleResponse('←'); });
        $(document).on('click.flankertask', '#fk-right', function () { handleResponse('→'); });
        $(document).on('keydown.flankertask', function (e) {
            if (state !== STATES.INPUT || responded) return;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); handleResponse('←'); }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); handleResponse('→'); }
        });
        $(document).on('visibilitychange.flankertask', function () {
            if (document.hidden && state === STATES.INPUT && !responded) {
                handleTimeout();
            }
        });
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        trialStartOffset = gameTimer.getElapsedMs();
        buildUI();
        CerebroAPI.post('/game/start', { game_slug: 'flanker-task' })
            .done(function (r) { sessionToken = r.token; }).fail(function () {});
        updateDisplay();
        updateProgress();
        setState(STATES.COUNTDOWN);
    }

    function cleanup() {
        clearTimeout(trialTimeoutId); clearTimeout(showTimeoutId);
        $(document).off('.flankertask');
        $board.empty().removeClass('fk-grid');
        state = STATES.INIT;
    }

    function getState() { return { state: state, level: level, trial: trial, score: score }; }

    return { init: init, startGame: startGame, cleanup: cleanup, getState: getState, STATES: STATES };

})(jQuery);
