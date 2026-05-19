/**
 * Cerebro — Syllogisms Game Engine
 *
 * Logical reasoning: judge whether a conclusion follows from premises.
 */

'use strict';

var Syllogisms = (function ($) {

    var STATES = {
        INIT: 'INIT', COUNTDOWN: 'COUNTDOWN', SHOWING: 'SHOWING',
        INPUT: 'INPUT', FEEDBACK: 'FEEDBACK', GAME_OVER: 'GAME_OVER'
    };

    var BASE_POINTS = 100;
    var COUNTDOWN_SECONDS = 3;
    var FEEDBACK_DELAY = 800;

    var DIFFICULTY = [
        { trials: 8, time: 15000, label: 'concrete' },
        { trials: 8, time: 12000, label: 'mixed' },
        { trials: 10, time: 10000, label: 'abstract' },
        { trials: 10, time: 9000, label: 'complex' },
        { trials: 12, time: 8000, label: 'advanced' }
    ];

    // Syllogism pool: [premises array, conclusion, valid]
    var POOL = [
        // Level 1-2: concrete
        { prem: ['All mammals are warm-blooded.', 'All dogs are mammals.'], conc: 'All dogs are warm-blooded.', valid: true, diff: 1 },
        { prem: ['All birds lay eggs.', 'All eagles are birds.'], conc: 'Eagles lay eggs.', valid: true, diff: 1 },
        { prem: ['No reptile has fur.', 'All snakes are reptiles.'], conc: 'Snakes have no fur.', valid: true, diff: 1 },
        { prem: ['All planets orbit a star.', 'All gas giants are planets.'], conc: 'All gas giants orbit a star.', valid: true, diff: 1 },
        { prem: ['All fish live in water.', 'All salmon are fish.'], conc: 'Salmon live in water.', valid: true, diff: 1 },
        { prem: ['All cats are mammals.', 'All dogs are mammals.'], conc: 'All cats are dogs.', valid: false, diff: 1 },
        { prem: ['All fruits have seeds.', 'All plants have seeds.'], conc: 'All fruits are plants.', valid: false, diff: 1 },
        { prem: ['Some birds can fly.', 'Penguins are birds.'], conc: 'Penguins can fly.', valid: false, diff: 1 },
        { prem: ['All metals conduct electricity.', 'Water conducts electricity.'], conc: 'Water is a metal.', valid: false, diff: 1 },
        { prem: ['Some animals are pets.', 'Some pets are cats.'], conc: 'Some animals are cats.', valid: false, diff: 1 },
        { prem: ['Every tree has roots.', 'An oak is a tree.'], conc: 'An oak has roots.', valid: true, diff: 1 },
        { prem: ['No insect has lungs.', 'A grasshopper is an insect.'], conc: 'A grasshopper has no lungs.', valid: true, diff: 1 },
        { prem: ['All tools are useful.', 'A broken hammer is a tool.'], conc: 'A broken hammer is useful.', valid: false, diff: 1 },
        // Level 3: abstract
        { prem: ['All A are B.', 'All B are C.'], conc: 'All A are C.', valid: true, diff: 3 },
        { prem: ['All A are B.', 'No B are C.'], conc: 'No A are C.', valid: true, diff: 3 },
        { prem: ['No A are B.', 'All C are A.'], conc: 'No C are B.', valid: true, diff: 3 },
        { prem: ['All A are B.', 'Some A are C.'], conc: 'Some B are C.', valid: true, diff: 3 },
        { prem: ['Some A are B.', 'All B are C.'], conc: 'Some A are C.', valid: true, diff: 3 },
        { prem: ['All A are B.', 'All C are B.'], conc: 'All A are C.', valid: false, diff: 3 },
        { prem: ['No A are B.', 'No C are B.'], conc: 'No A are C.', valid: false, diff: 3 },
        // Level 4: abstract with negations
        { prem: ['All A are B.', 'No C are B.'], conc: 'No A are C.', valid: true, diff: 4 },
        { prem: ['No A are B.', 'All C are B.'], conc: 'Some C are not A.', valid: true, diff: 4 },
        { prem: ['Some A are not B.', 'All B are C.'], conc: 'Some A are not C.', valid: false, diff: 4 },
        { prem: ['No A are B.', 'No A are C.'], conc: 'No B are C.', valid: false, diff: 4 },
        { prem: ['Some A are B.', 'No B are C.'], conc: 'Some A are not C.', valid: true, diff: 4 },
        // Level 5: complex
        { prem: ['All A are B.', 'All B are C.', 'No D are C.'], conc: 'No D are A.', valid: true, diff: 5 },
        { prem: ['All A are B.', 'Some A are C.', 'All C are D.'], conc: 'Some B are D.', valid: true, diff: 5 },
        { prem: ['Some A are not B.', 'All C are B.', 'All A are D.'], conc: 'Some D are not C.', valid: true, diff: 5 },
        { prem: ['No A are B.', 'All C are B.', 'All D are A.'], conc: 'No D are C.', valid: true, diff: 5 },
        { prem: ['All A are B.', 'All C are B.', 'All D are A.'], conc: 'All D are C.', valid: false, diff: 5 },
        { prem: ['Some A are B.', 'Some B are C.', 'No A are D.'], conc: 'Some C are not D.', valid: false, diff: 5 }
    ];

    var state = STATES.INIT;
    var level = 1, trial = 0, score = 0;
    var correctCount = 0, wrongCount = 0;
    var currentItem = null;
    var responded = false;
    var trialTimeoutId = null;
    var sessionToken = null;
    var gameTimer = null;
    var trialData = [];
    var usedIndices = [];

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

    function pickSyllogism() {
        var diff = getDifficulty(level);
        var available = [];
        POOL.forEach(function (item, idx) {
            if (item.diff <= level && usedIndices.indexOf(idx) === -1) {
                available.push(idx);
            }
        });
        if (available.length === 0) {
            usedIndices = [];
            available = [];
            POOL.forEach(function (item, idx) {
                if (item.diff <= level) available.push(idx);
            });
        }
        var pick = available[Math.floor(Math.random() * available.length)];
        usedIndices.push(pick);
        return POOL[pick];
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
        correctCount = 0; wrongCount = 0;
        usedIndices = []; trialData = []; sessionToken = null;
        clearTimeout(trialTimeoutId);
        if (gameTimer) gameTimer.reset();
    }

    function buildUI() {
        $board.empty().addClass('sg-grid');
        $board.html(
            '<div class="sg-premises" id="sg-premises"></div>' +
            '<div class="sg-divider">∴</div>' +
            '<div class="sg-conclusion" id="sg-conclusion"></div>' +
            '<div class="sg-buttons">' +
                '<button class="sg-btn sg-btn-valid" id="sg-valid" type="button">' +
                    'Valid' +
                    '<span class="sg-key-hint">↑ / Y</span>' +
                '</button>' +
                '<button class="sg-btn sg-btn-invalid" id="sg-invalid" type="button">' +
                    'Invalid' +
                    '<span class="sg-key-hint">↓ / N</span>' +
                '</button>' +
            '</div>' +
            '<div class="sg-feedback" id="sg-feedback"></div>' +
            '<div class="sg-progress" id="sg-progress"></div>'
        );
    }

    function updateProgress() {
        var diff = getDifficulty(level);
        var $p = $('#sg-progress');
        $p.empty();
        for (var i = 0; i < diff.trials; i++) {
            var cls = 'sg-dot';
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

    function startTrial() {
        currentItem = pickSyllogism();
        responded = false;
        var diff = getDifficulty(level);

        // Render premises
        var $prem = $('#sg-premises');
        $prem.empty();
        currentItem.prem.forEach(function (p) {
            $prem.append('<div class="sg-premise">' + p + '</div>');
        });

        // Render conclusion
        $('#sg-conclusion').text(currentItem.conc);
        $('#sg-feedback').text('').removeClass('correct wrong timeout');
        $('#sg-valid, #sg-invalid').prop('disabled', false);

        state = STATES.INPUT;
        setStatus('Does the conclusion follow?', 'your-turn');
        updateDisplay();

        trialTimeoutId = setTimeout(function () {
            if (state === STATES.INPUT && !responded) {
                handleTimeout();
            }
        }, diff.time);
    }

    function handleResponse(playerSaysValid) {
        if (state !== STATES.INPUT || responded) return;
        responded = true;
        clearTimeout(trialTimeoutId);

        var correct = (playerSaysValid === currentItem.valid);
        var diff = getDifficulty(level);
        var timeUsed = diff.time - 0; // approximate
        var speedBonus = Math.max(0, Math.round((diff.time / 1000) * 5));

        if (correct) {
            correctCount++;
            var trialScore = BASE_POINTS + speedBonus;
            score += trialScore;
            $('#sg-feedback').text('Correct! +' + trialScore).addClass('correct');
            if (window.CerebroSound) CerebroSound.correct();
        } else {
            wrongCount++;
            $('#sg-feedback').text(currentItem.valid ? 'Invalid — conclusion follows' : 'Valid — conclusion does not follow').addClass('wrong');
            if (window.CerebroSound) CerebroSound.wrong();
        }

        trialData.push({
            premises: currentItem.prem,
            conclusion: currentItem.conc,
            correct: correct,
            valid: currentItem.valid
        });

        $('#sg-valid, #sg-invalid').prop('disabled', true);
        updateDisplay();
        updateProgress();

        trialTimeoutId = setTimeout(function () {
            trial++;
            var d = getDifficulty(level);
            if (trial >= d.trials) { setState(STATES.GAME_OVER); }
            else {
                if (trial % 3 === 0 && level < DIFFICULTY.length) level++;
                startTrial();
            }
        }, FEEDBACK_DELAY);
    }

    function handleTimeout() {
        if (responded) return;
        responded = true;
        wrongCount++;
        $('#sg-feedback').text('Time expired — ' + (currentItem.valid ? 'Valid' : 'Invalid')).addClass('timeout');

        trialData.push({
            premises: currentItem.prem,
            conclusion: currentItem.conc,
            correct: false,
            valid: currentItem.valid
        });

        $('#sg-valid, #sg-invalid').prop('disabled', true);
        updateProgress();

        trialTimeoutId = setTimeout(function () {
            trial++;
            var d = getDifficulty(level);
            if (trial >= d.trials) { setState(STATES.GAME_OVER); }
            else {
                if (trial % 3 === 0 && level < DIFFICULTY.length) level++;
                startTrial();
            }
        }, FEEDBACK_DELAY);
    }

    function endGame() {
        gameTimer.stop();
        setStatus('Session complete', 'wrong');
        var total = correctCount + wrongCount;
        var acc = total > 0 ? Math.round(correctCount / total * 100) : 0;
        var title = acc >= 90 ? 'Sharp Logic' : acc >= 75 ? 'Solid Reasoner' : acc >= 60 ? 'Getting There' : 'Keep Practicing';

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
                reaction: 0,
                streak: correctCount
            });
        }
        if (score > 2000 && window.CerebroApp && CerebroApp.spawnConfetti) CerebroApp.spawnConfetti();
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            var payload = {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: { rounds: trialData.map(function (t) { return { sequence: [], input: [t.correct ? 1 : 0], time_ms: 0 }; }) },
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
        $(document).off('.syllogisms');
        $(document).on('click.syllogisms', '#sg-valid', function () { handleResponse(true); });
        $(document).on('click.syllogisms', '#sg-invalid', function () { handleResponse(false); });
        $(document).on('keydown.syllogisms', function (e) {
            if (state !== STATES.INPUT || responded) return;
            if (e.code === 'ArrowUp' || e.code === 'KeyY') { e.preventDefault(); handleResponse(true); }
            if (e.code === 'ArrowDown' || e.code === 'KeyN') { e.preventDefault(); handleResponse(false); }
        });
        $(document).on('visibilitychange.syllogisms', function () {
            if (document.hidden && state === STATES.INPUT && !responded) {
                handleTimeout();
            }
        });
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        buildUI();
        CerebroAPI.post('/game/start', { game_slug: 'syllogisms' })
            .done(function (r) { sessionToken = r.token; }).fail(function () {});
        updateDisplay();
        updateProgress();
        setState(STATES.COUNTDOWN);
    }

    function cleanup() {
        clearTimeout(trialTimeoutId);
        $(document).off('.syllogisms');
        $board.empty().removeClass('sg-grid');
        state = STATES.INIT;
    }

    function getState() { return { state: state, level: level, trial: trial, score: score }; }

    return { init: init, startGame: startGame, cleanup: cleanup, getState: getState, STATES: STATES };

})(jQuery);
