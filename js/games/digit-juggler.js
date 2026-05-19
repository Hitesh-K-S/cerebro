/**
 * Cerebro — Digit Juggler Game Engine
 * 
 * N-back working memory challenge.
 * Cognitive Skill: Working Memory
 */

'use strict';

var DigitJuggler = (function ($) {

    // ══════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════

    var STATES = {
        INIT: 'INIT', INSTRUCTIONS: 'INSTRUCTIONS', COUNTDOWN: 'COUNTDOWN',
        PLAYING: 'PLAYING', PAUSE: 'PAUSE', RESULTS: 'RESULTS'
    };

    var BASE_POINTS = 100;
    var MATCH_RATE = 0.30;
    var FALSE_ALARM_PENALTY = -50;
    var AFK_THRESHOLD = 5;

    var DIFFICULTY = [
        { nBack: 1, stimulusDuration: 2500, count: 20, pool: [1, 2, 3, 4, 5] },
        { nBack: 1, stimulusDuration: 2000, count: 22, pool: [1, 2, 3, 4, 5, 6, 7] },
        { nBack: 2, stimulusDuration: 2000, count: 24, pool: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
        { nBack: 2, stimulusDuration: 1600, count: 26, pool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
        { nBack: 3, stimulusDuration: 1500, count: 28, pool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ];

    // ══════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════

    var state = STATES.INIT;
    var level = 1;
    var score = 0;
    var sequence = [];
    var isMatch = [];
    var responses = [];
    var currentIndex = -1;
    var responded = false;
    var afkCounter = 0;
    var stimulusTimeout = null;
    var sessionToken = null;
    var gameTimer = CerebroTimer.create();
    var reactionTimer = CerebroTimer.create();

    // Stats
    var hits = 0, misses = 0, falseAlarms = 0, correctRejections = 0;

    // ══════════════════════════════════════════════════════
    // DOM
    // ══════════════════════════════════════════════════════

    var $container, $digitDisplay, $btnMatch, $btnNoMatch;
    var $nbackIndicator, $accuracyDisplay, $progressDots;

    function cacheDom() {
        $container = $('#game-area');
        $digitDisplay = $('#dj-digit');
        $btnMatch = $('#dj-btn-match');
        $btnNoMatch = $('#dj-btn-nomatch');
        $nbackIndicator = $('#dj-nback-indicator');
        $accuracyDisplay = $('#dj-accuracy');
        $progressDots = $('#dj-progress');
    }

    // ══════════════════════════════════════════════════════
    // DIFFICULTY
    // ══════════════════════════════════════════════════════

    function getDifficulty(lvl) {
        if (lvl <= DIFFICULTY.length) return DIFFICULTY[lvl - 1];
        return {
            nBack: 3 + Math.floor((lvl - DIFFICULTY.length) / 2),
            stimulusDuration: 1300,
            count: 30,
            pool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        };
    }

    // ══════════════════════════════════════════════════════
    // SEQUENCE GENERATION
    // ══════════════════════════════════════════════════════

    function generateSequence(diff) {
        sequence = [];
        isMatch = [];
        var n = diff.nBack;
        var pool = diff.pool;
        var count = diff.count;

        for (var i = 0; i < count; i++) {
            if (i >= n && Math.random() < MATCH_RATE) {
                // Create a match
                sequence.push(sequence[i - n]);
                isMatch.push(true);
            } else {
                // Pick a non-matching digit
                var digit;
                do {
                    digit = pool[Math.floor(Math.random() * pool.length)];
                } while (i >= n && digit === sequence[i - n]);
                sequence.push(digit);
                isMatch.push(false);
            }
        }
    }

    // ══════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════

    function buildUI(diff) {
        var html = '<div class="nback-indicator" id="dj-nback-indicator">' +
            'Remember <strong>' + diff.nBack + '</strong> digit' + (diff.nBack > 1 ? 's' : '') + ' back</div>' +
            '<div class="digit-display" id="dj-digit">—</div>' +
            '<div class="match-buttons">' +
            '  <button class="btn-match btn-match-yes" id="dj-btn-match">✓ Match</button>' +
            '  <button class="btn-match btn-match-no" id="dj-btn-nomatch">✗ No Match</button>' +
            '</div>' +
            '<div class="accuracy-display" id="dj-accuracy">Accuracy: <span class="accuracy-value">—</span></div>' +
            '<div class="stimulus-progress" id="dj-progress"></div>';

        // Replace game area content
        $('#game-board').hide();
        $('#game-start-screen').addClass('hidden');
        var $custom = $('#dj-container');
        if ($custom.length === 0) {
            $custom = $('<div id="dj-container"></div>').appendTo('#game-area');
        }
        $custom.html(html).show();

        // Build progress dots
        var dotsHtml = '';
        for (var i = 0; i < diff.count; i++) {
            dotsHtml += '<div class="stimulus-dot" data-idx="' + i + '"></div>';
        }
        $('#dj-progress').html(dotsHtml);

        cacheDom();
    }

    function showDigit(digit) {
        $digitDisplay.text(digit).removeClass('flash-in flash-correct flash-wrong flash-nogo');
        // Force reflow for animation restart
        $digitDisplay[0].offsetWidth;
        $digitDisplay.addClass('flash-in');
    }

    function updateAccuracy() {
        var total = hits + misses + falseAlarms + correctRejections;
        if (total === 0) return;
        var acc = ((hits + correctRejections) / total * 100).toFixed(1);
        $accuracyDisplay.find('.accuracy-value').text(acc + '%');
    }

    function updateProgressDot(index, cls) {
        $('#dj-progress .stimulus-dot[data-idx="' + index + '"]')
            .addClass(cls).removeClass('current');
    }

    function highlightCurrentDot(index) {
        $('#dj-progress .stimulus-dot').removeClass('current');
        $('#dj-progress .stimulus-dot[data-idx="' + index + '"]').addClass('current');
    }

    // ══════════════════════════════════════════════════════
    // STATE MACHINE
    // ══════════════════════════════════════════════════════

    function setState(s) {
        state = s;
        console.log('[DigitJuggler] → ' + s);
    }

    // ══════════════════════════════════════════════════════
    // GAMEPLAY
    // ══════════════════════════════════════════════════════

    function nextStimulus() {
        currentIndex++;
        var diff = getDifficulty(level);

        if (currentIndex >= sequence.length) {
            endGame();
            return;
        }

        responded = false;
        highlightCurrentDot(currentIndex);
        showDigit(sequence[currentIndex]);
        reactionTimer.reset().start();

        // Enable buttons
        $btnMatch.removeClass('disabled');
        $btnNoMatch.removeClass('disabled');

        // Auto-advance after stimulus duration
        clearTimeout(stimulusTimeout);
        stimulusTimeout = setTimeout(function () {
            if (!responded) {
                handleNoResponse();
            }
        }, diff.stimulusDuration);
    }

    function handleResponse(playerSaysMatch) {
        if (state !== STATES.PLAYING || responded) return;
        responded = true;
        reactionTimer.stop();
        clearTimeout(stimulusTimeout);

        var actualMatch = isMatch[currentIndex];
        var reactionMs = reactionTimer.getElapsedMs();
        var diff = getDifficulty(level);

        var result;
        if (playerSaysMatch && actualMatch) {
            // Hit
            hits++;
            result = 'hit';
            var speedBonus = Math.max(0.3, 1.0 - (reactionMs / diff.stimulusDuration));
            score += Math.round(BASE_POINTS * (1 + diff.nBack * 0.5) * speedBonus);
            $digitDisplay.addClass('flash-correct');
            if (window.CerebroSound) CerebroSound.correct();
            updateProgressDot(currentIndex, 'hit');
        } else if (playerSaysMatch && !actualMatch) {
            // False alarm
            falseAlarms++;
            result = 'false-alarm';
            score += FALSE_ALARM_PENALTY;
            $digitDisplay.addClass('flash-wrong');
            if (window.CerebroSound) CerebroSound.wrong();
            updateProgressDot(currentIndex, 'false-alarm');
        } else if (!playerSaysMatch && actualMatch) {
            // Miss
            misses++;
            result = 'miss';
            $digitDisplay.addClass('flash-wrong');
            if (window.CerebroSound) CerebroSound.wrong();
            updateProgressDot(currentIndex, 'miss');
        } else {
            // Correct rejection
            correctRejections++;
            result = 'correct-reject';
            score += 20;
            $digitDisplay.addClass('flash-nogo');
            if (window.CerebroSound) CerebroSound.correct();
            updateProgressDot(currentIndex, 'correct-reject');
        }

        responses.push({
            stimulusIndex: currentIndex,
            action: playerSaysMatch ? 'match' : 'no-match',
            reactionMs: reactionMs,
            result: result
        });

        afkCounter = 0;
        score = Math.max(0, score);
        updateDisplay();
        updateAccuracy();

        // Disable buttons
        $btnMatch.addClass('disabled');
        $btnNoMatch.addClass('disabled');

        // Next stimulus after brief delay
        setTimeout(nextStimulus, 500);
    }

    function handleNoResponse() {
        if (responded) return;
        responded = true;

        var actualMatch = isMatch[currentIndex];
        if (actualMatch) {
            misses++;
            updateProgressDot(currentIndex, 'miss');
        } else {
            correctRejections++;
            score += 10;
            updateProgressDot(currentIndex, 'correct-reject');
        }

        responses.push({
            stimulusIndex: currentIndex,
            action: 'none',
            reactionMs: null,
            result: actualMatch ? 'miss' : 'correct-reject'
        });

        afkCounter++;
        updateDisplay();
        updateAccuracy();

        // AFK detection
        if (afkCounter >= AFK_THRESHOLD) {
            setState(STATES.PAUSE);
            setStatus('Are you still there? Click to continue.', 'wrong');
            return;
        }

        setTimeout(nextStimulus, 300);
    }

    // ══════════════════════════════════════════════════════
    // GAME LIFECYCLE
    // ══════════════════════════════════════════════════════

    function startGame() {
        level = 1;
        score = 0;
        currentIndex = -1;
        responded = false;
        afkCounter = 0;
        hits = misses = falseAlarms = correctRejections = 0;
        responses = [];
        sessionToken = null;

        var diff = getDifficulty(level);
        generateSequence(diff);
        buildUI(diff);
        gameTimer.reset().start();

        // Request session token
        CerebroAPI.post('/game/start', { game_slug: 'digit-juggler' })
            .done(function (r) { sessionToken = r.token; })
            .fail(function () { /* offline mode */ });

        updateDisplay();

        // Countdown then start
        runCountdown(function () {
            setState(STATES.PLAYING);
            setStatus('Is this digit a match?', 'watching');
            nextStimulus();
        });
    }

    function endGame() {
        setState(STATES.RESULTS);
        gameTimer.stop();
        clearTimeout(stimulusTimeout);
        $btnMatch.addClass('disabled');
        $btnNoMatch.addClass('disabled');
        $digitDisplay.text('✓');

        // Calculate d-prime approximation
        var totalTargets = isMatch.filter(Boolean).length;
        var totalNon = isMatch.length - totalTargets;
        var hitRate = Math.min(0.99, Math.max(0.01, totalTargets > 0 ? hits / totalTargets : 0.5));
        var faRate = Math.min(0.99, Math.max(0.01, totalNon > 0 ? falseAlarms / totalNon : 0.5));
        // Simple Z approximation
        var zHit = approxZScore(hitRate);
        var zFa = approxZScore(faRate);
        var dPrime = (zHit - zFa).toFixed(2);

        if (window.CerebroSound) CerebroSound.complete();
        showGameOverModal(dPrime);
        saveScore(dPrime);
    }

    // Simple Z-score approximation (Abramowitz & Stegun)
    function approxZScore(p) {
        if (p <= 0) p = 0.01;
        if (p >= 1) p = 0.99;
        var t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
        var z = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) /
            (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
        return p < 0.5 ? -z : z;
    }

    function showGameOverModal(dPrime) {
        var acc = Math.round((hits + correctRejections) / sequence.length * 100);
        $('#result-level').text('N=' + getDifficulty(level).nBack);
        $('#result-rounds').text(hits + '/' + isMatch.filter(Boolean).length + ' hits');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        var title = acc > 85 ? 'Impressive Work' : acc > 60 ? 'Good Effort' : 'Keep Practicing';
        $('#modal-title').text(title);
        $('#result-badge').addClass('hidden');
        if (window.CerebroApp && CerebroApp.animateScore) {
            CerebroApp.animateScore(score);
        } else {
            $('#result-score').text(score);
        }
        if (window.CerebroApp && CerebroApp.setTierBadge) {
            CerebroApp.setTierBadge(score);
        }
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) {
            var totalTrials = sequence.length;
            var totalCorrect = hits + correctRejections;
            var accPct = totalTrials > 0 ? Math.round(totalCorrect / totalTrials * 100) : 0;
            CerebroApp.updatePerformanceMeters({
                accuracy: accPct,
                reaction: 0,
                streak: hits
            });
        }
        if (score > 2000 && window.CerebroApp && CerebroApp.spawnConfetti) {
            CerebroApp.spawnConfetti();
        }
        $('#modal-gameover').removeClass('hidden');
    }

    function saveScore(dPrime) {
        if (!sessionToken) return;
        var diff = getDifficulty(level);
        var payload = {
            token: sessionToken,
            score: score,
            level_reached: level,
            duration_ms: gameTimer.getElapsedMs(),
            replay: {
                rounds: [{ sequence: sequence, input: responses, time_ms: gameTimer.getElapsedMs() }],
                d_prime: parseFloat(dPrime),
                n_back_level: diff.nBack,
                hits: hits, misses: misses,
                false_alarms: falseAlarms,
                correct_rejections: correctRejections
            }
        };
        CerebroAPI.post('/game/end', payload).fail(function () {
            CerebroAPI.queueForRetry('POST', '/game/end', payload);
        });
    }

    // ══════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════

    function runCountdown(callback) {
        var $overlay = $('#countdown-overlay');
        var $number = $('#countdown-number');
        var count = 3;
        $overlay.removeClass('hidden');
        $number.text(count);

        var interval = setInterval(function () {
            count--;
            if (count > 0) {
                $number.text(count);
            } else {
                clearInterval(interval);
                $overlay.addClass('hidden');
                callback();
            }
        }, 1000);
    }

    function setStatus(text, cls) {
        var $status = $('#game-status');
        $status.removeClass('watching your-turn correct wrong');
        if (cls) $status.addClass(cls);
        $('#status-text').text(text);
    }

    function updateDisplay() {
        $('#display-level').text('Lv.' + level);
        $('#display-round').text((currentIndex + 1) + '/' + sequence.length);
        $('#display-score').text(score);
    }

    function bindEvents() {
        $(document).off('.digitjuggler');

        $(document).on('click.digitjuggler', '#dj-btn-match', function () {
            handleResponse(true);
        });
        $(document).on('click.digitjuggler', '#dj-btn-nomatch', function () {
            handleResponse(false);
        });

        // Keyboard: Space = Match, X = No Match
        $(document).on('keydown.digitjuggler', function (e) {
            if (state !== STATES.PLAYING || responded) return;
            if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); handleResponse(true); }
            if (e.code === 'KeyX' || e.code === 'KeyN') { e.preventDefault(); handleResponse(false); }
        });

        // Resume from AFK pause
        $(document).on('click.digitjuggler', '#game-area', function () {
            if (state === STATES.PAUSE) {
                afkCounter = 0;
                setState(STATES.PLAYING);
                setStatus('Is this digit a match?', 'watching');
                nextStimulus();
            }
        });

        // Visibility
        $(document).on('visibilitychange.digitjuggler', function () {
            if (document.hidden && state === STATES.PLAYING) {
                clearTimeout(stimulusTimeout);
                setState(STATES.PAUSE);
            }
        });
    }

    // ══════════════════════════════════════════════════════
    // PUBLIC
    // ══════════════════════════════════════════════════════

    function init() {
        cacheDom();
        bindEvents();
    }

    function cleanup() {
        clearTimeout(stimulusTimeout);
        $(document).off('.digitjuggler');
        $('#dj-container').remove();
        setState(STATES.INIT);
    }

    return {
        slug: 'digit-juggler', name: 'Digit Juggler', category: 'memory',
        init: init, startGame: startGame, cleanup: cleanup,
        getState: function () { return { state: state, score: score, level: level }; },
        STATES: STATES
    };

})(jQuery);
