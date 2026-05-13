/**
 * Cerebro — Pattern Recall Game Engine
 * 
 * State machine-driven game with difficulty scaling,
 * scoring, replay recording, and anti-cheat data collection.
 */

'use strict';

var PatternRecall = (function ($) {

    // ══════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        SHOWING: 'SHOWING',
        INPUT: 'INPUT',
        ROUND_COMPLETE: 'ROUND_COMPLETE',
        GAME_OVER: 'GAME_OVER'
    };

    var BASE_POINTS = 100;
    var DEBOUNCE_MS = 200;
    var COUNTDOWN_SECONDS = 3;
    var ROUND_COMPLETE_DELAY = 1200;
    var BETWEEN_FLASH_GAP = 200; // ms gap between tile flashes

    // Difficulty table: [gridSize, seqLength, flashMs, inputTimeoutMs]
    var DIFFICULTY = [
        { grid: 3, seq: 3, flash: 800, timeout: 10000 },  // Level 1
        { grid: 3, seq: 4, flash: 700, timeout: 9000 },  // Level 2
        { grid: 4, seq: 5, flash: 600, timeout: 8000 },  // Level 3
        { grid: 4, seq: 6, flash: 500, timeout: 7000 },  // Level 4
        { grid: 5, seq: 7, flash: 400, timeout: 6000 },  // Level 5
    ];

    // For levels beyond the table, use these increments
    var EXTENDED_LEVEL = {
        grid: 5,
        seqBase: 7,
        seqIncrement: 1,
        flash: 350,
        timeout: 5000
    };

    // ══════════════════════════════════════════════════════
    // GAME STATE
    // ══════════════════════════════════════════════════════

    var state = STATES.INIT;
    var level = 1;
    var round = 1;
    var score = 0;
    var lives = 3;
    var sequence = [];
    var playerInput = [];
    var inputIndex = 0;
    var lastClickTime = 0;
    var keyboardCursor = 0;
    var sessionToken = null;

    // Timers
    var gameTimer = CerebroTimer.create();
    var roundTimer = CerebroTimer.create();
    var inputTimeoutId = null;
    var progressIntervalId = null;

    // Replay data (for anti-cheat)
    var replay = { rounds: [] };

    // Visibility handling
    var wasShowingWhenBlurred = false;

    // ══════════════════════════════════════════════════════
    // DOM REFERENCES
    // ══════════════════════════════════════════════════════

    var $grid, $countdownOverlay, $countdownNumber;
    var $statusText, $startScreen, $progressContainer, $progressBar;
    var $displayLevel, $displayRound, $displayScore, $displayLives;

    var progressSegments = [];
    var totalSegments = 0;

    function cacheDom() {
        $grid = $('#game-board');
        $countdownOverlay = $('#countdown-overlay');
        $countdownNumber = $('#countdown-number');
        $statusText = $('#status-text');
        $startScreen = $('#game-start-screen');
        $progressContainer = $('#progress-bar-container');
        $displayLevel = $('#display-level');
        $displayRound = $('#display-round');
        $displayScore = $('#display-score');
        $displayLives = $('#display-lives');
    }

    // ══════════════════════════════════════════════════════
    // DIFFICULTY HELPER
    // ══════════════════════════════════════════════════════

    function getDifficulty(lvl) {
        if (lvl <= DIFFICULTY.length) {
            return DIFFICULTY[lvl - 1];
        }
        // Extended difficulty for levels beyond the table
        var extra = lvl - DIFFICULTY.length;
        return {
            grid: EXTENDED_LEVEL.grid,
            seq: EXTENDED_LEVEL.seqBase + (extra * EXTENDED_LEVEL.seqIncrement),
            flash: EXTENDED_LEVEL.flash,
            timeout: EXTENDED_LEVEL.timeout
        };
    }

    // ══════════════════════════════════════════════════════
    // STATE MACHINE
    // ══════════════════════════════════════════════════════

    function setState(newState) {
        var oldState = state;
        state = newState;
        console.log('[PatternRecall] ' + oldState + ' → ' + newState);
        onStateEnter(newState);
    }

    function onStateEnter(s) {
        switch (s) {
            case STATES.COUNTDOWN:
                runCountdown();
                break;
            case STATES.SHOWING:
                showSequence();
                break;
            case STATES.INPUT:
                startInput();
                break;
            case STATES.ROUND_COMPLETE:
                handleRoundComplete();
                break;
            case STATES.GAME_OVER:
                handleGameOver();
                break;
        }
    }

    // ══════════════════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════════════════

    function init() {
        cacheDom();
        bindEvents();
        setState(STATES.INIT);
    }

    function resetGame() {
        level = 1;
        round = 1;
        score = 0;
        lives = 3;
        sequence = [];
        playerInput = [];
        inputIndex = 0;
        keyboardCursor = 0;
        sessionToken = null;
        replay = { rounds: [] };

        clearTimeout(inputTimeoutId);
        clearInterval(progressIntervalId);
        gameTimer.reset();
        roundTimer.reset();

        updateDisplay();
    }

    // ══════════════════════════════════════════════════════
    // GRID RENDERING
    // ══════════════════════════════════════════════════════

    function buildGrid(size) {
        $grid.empty();
        $grid.removeClass('pattern-grid grid-3 grid-4 grid-5 round-complete');
        $grid.addClass('pattern-grid grid-' + size);

        var totalTiles = size * size;
        for (var i = 0; i < totalTiles; i++) {
            var $tile = $('<div>')
                .addClass('tile')
                .attr('data-index', i);
            $grid.append($tile);
        }
    }

    // ══════════════════════════════════════════════════════
    // SEQUENCE GENERATION
    // ══════════════════════════════════════════════════════

    function generateSequence(length, gridSize) {
        var totalTiles = gridSize * gridSize;
        var seq = [];
        for (var i = 0; i < length; i++) {
            seq.push(Math.floor(Math.random() * totalTiles));
        }
        return seq;
    }

    // ══════════════════════════════════════════════════════
    // COUNTDOWN
    // ══════════════════════════════════════════════════════

    function runCountdown() {
        var count = COUNTDOWN_SECONDS;
        $startScreen.addClass('hidden');
        $countdownOverlay.removeClass('hidden');
        $countdownNumber.text(count);

        var countInterval = setInterval(function () {
            count--;
            if (count > 0) {
                $countdownNumber.text(count);
            } else {
                clearInterval(countInterval);
                $countdownOverlay.addClass('hidden');
                startNewRound();
            }
        }, 1000);
    }

    // ══════════════════════════════════════════════════════
    // ROUND MANAGEMENT
    // ══════════════════════════════════════════════════════

    function startNewRound() {
        var diff = getDifficulty(level);

        // Rebuild grid if size changed
        var currentGridClass = $grid.hasClass('grid-3') ? 3 : ($grid.hasClass('grid-4') ? 4 : 5);
        if (currentGridClass !== diff.grid || $grid.children().length !== diff.grid * diff.grid) {
            buildGrid(diff.grid);
        }

        // Generate sequence
        sequence = generateSequence(diff.seq, diff.grid);
        playerInput = [];
        inputIndex = 0;

        updateDisplay();
        setState(STATES.SHOWING);
    }

    // ══════════════════════════════════════════════════════
    // SEQUENCE DISPLAY
    // ══════════════════════════════════════════════════════

    function showSequence() {
        setTilesDisabled(true);
        setStatus('Watch the pattern...', 'watching');
        $progressContainer.addClass('hidden');

        var diff = getDifficulty(level);
        var flashDuration = diff.flash;
        var i = 0;

        function flashNext() {
            if (state !== STATES.SHOWING) return; // Guard against state change

            if (i >= sequence.length) {
                // Done showing
                setState(STATES.INPUT);
                return;
            }

            var tileIndex = sequence[i];
            var $tile = $grid.find('[data-index="' + tileIndex + '"]');

            $tile.addClass('flash');
            setTimeout(function () {
                $tile.removeClass('flash');
                i++;
                setTimeout(flashNext, BETWEEN_FLASH_GAP);
            }, flashDuration);
        }

        // Small delay before first flash
        setTimeout(flashNext, 500);
    }

    // ══════════════════════════════════════════════════════
    // INPUT HANDLING
    // ══════════════════════════════════════════════════════

    function startInput() {
        setTilesDisabled(false);
        setStatus('Your turn! Tap the tiles', 'your-turn');
        roundTimer.reset().start();
        startInputTimeout();
    }

    function buildSegmentedBar(count) {
        totalSegments = count || sequence.length;
        $progressContainer.empty().removeClass('hidden');
        for (var i = 0; i < totalSegments; i++) {
            var $seg = $('<div>').addClass('progress-seg').attr('data-seg', i);
            $progressContainer.append($seg);
        }
    }

    function updateSegmentedBar(completed, total) {
        var segs = $progressContainer.find('.progress-seg');
        segs.each(function (i) {
            var $s = $(this);
            if (i < completed) {
                $s.addClass('filled').removeClass('active warning danger');
            } else if (i === completed) {
                $s.addClass('active');
            } else {
                $s.removeClass('filled active warning danger');
            }
        });
    }

    function startInputTimeout() {
        var diff = getDifficulty(level);
        var totalTimeout = diff.timeout;
        var startTime = performance.now();

        buildSegmentedBar(sequence.length);

        clearInterval(progressIntervalId);
        progressIntervalId = setInterval(function () {
            var elapsed = performance.now() - startTime;
            var remaining = Math.max(0, 1 - (elapsed / totalTimeout));
            var completed = Math.floor((1 - remaining) * sequence.length);
            updateSegmentedBar(Math.min(completed, inputIndex), sequence.length);

            var segs = $progressContainer.find('.progress-seg');
            if (remaining < 0.25) {
                segs.filter('.active').addClass('danger').removeClass('warning');
            } else if (remaining < 0.5) {
                segs.filter('.active').addClass('warning');
            }
        }, 50);

        clearTimeout(inputTimeoutId);
        inputTimeoutId = setTimeout(function () {
            clearInterval(progressIntervalId);
            handleWrongInput();
        }, totalTimeout);
    }

    function handleTileClick(tileIndex) {
        // Guard: only accept input in INPUT state
        if (state !== STATES.INPUT) return;

        // Debounce
        var now = performance.now();
        if (now - lastClickTime < DEBOUNCE_MS) return;
        lastClickTime = now;

        var $tile = $grid.find('[data-index="' + tileIndex + '"]');
        playerInput.push(tileIndex);

        if (tileIndex === sequence[inputIndex]) {
            // Correct tap
            $tile.addClass('correct');
            if (window.CerebroSound) CerebroSound.correct();
            setTimeout(function () { $tile.removeClass('correct'); }, 300);

            inputIndex++;

            if (inputIndex >= sequence.length) {
                // Round complete!
                clearTimeout(inputTimeoutId);
                clearInterval(progressIntervalId);
                roundTimer.stop();

                // Record replay
                replay.rounds.push({
                    sequence: sequence.slice(),
                    input: playerInput.slice(),
                    time_ms: roundTimer.getElapsedMs()
                });

                // Calculate round score
                var roundScore = calculateRoundScore();
                score += roundScore;
                showScorePopup(roundScore);

                setState(STATES.ROUND_COMPLETE);
            }
        } else {
            // Wrong tap
            $tile.addClass('wrong');
            if (window.CerebroSound) CerebroSound.wrong();
            setTimeout(function () { $tile.removeClass('wrong'); }, 500);

            clearTimeout(inputTimeoutId);
            clearInterval(progressIntervalId);
            roundTimer.stop();

            // Record the failed round
            replay.rounds.push({
                sequence: sequence.slice(),
                input: playerInput.slice(),
                time_ms: roundTimer.getElapsedMs()
            });

            handleWrongInput();
        }
    }

    function handleWrongInput() {
        lives--;
        updateLivesDisplay();
        setStatus('Wrong!', 'wrong');

        if (lives <= 0) {
            setTimeout(function () {
                setState(STATES.GAME_OVER);
            }, 800);
        } else {
            // Retry the same round
            setTilesDisabled(true);
            $progressContainer.addClass('hidden');
            setTimeout(function () {
                playerInput = [];
                inputIndex = 0;
                setState(STATES.SHOWING);
            }, 1200);
        }
    }

    // ══════════════════════════════════════════════════════
    // ROUND COMPLETE
    // ══════════════════════════════════════════════════════

    function handleRoundComplete() {
        setTilesDisabled(true);
        setStatus('Correct! 🎉', 'correct');
        $progressContainer.addClass('hidden');
        $grid.addClass('round-complete');

        setTimeout(function () {
            $grid.removeClass('round-complete');

            // Level up logic
            round++;
            var prevDiff = getDifficulty(level);
            var nextLevel = level + 1;
            var nextDiff = getDifficulty(nextLevel);

            // Level up if sequence length increases
            if (nextDiff.seq > prevDiff.seq || nextDiff.grid > prevDiff.grid) {
                level = nextLevel;
            } else {
                level = nextLevel;
            }

            startNewRound();
        }, ROUND_COMPLETE_DELAY);
    }

    // ══════════════════════════════════════════════════════
    // GAME OVER
    // ══════════════════════════════════════════════════════

    function handleGameOver() {
        gameTimer.stop();
        setTilesDisabled(true);
        setStatus('Session complete', 'wrong');

        if (window.CerebroSound) CerebroSound.complete();

        // Show game over modal
        showGameOverModal();

        // Save score to server
        saveScore();
    }

    function showGameOverModal() {
        var totalRounds = round - 1;
        var accuracy = 0;
        var avgReaction = 0;
        var maxStreak = 0;

        if (replay.rounds.length > 0) {
            var correctCount = 0;
            var totalReaction = 0;
            var currentStreak = 0;
            replay.rounds.forEach(function (r) {
                var isCorrect = r.input.length === r.sequence.length;
                for (var i = 0; i < r.input.length; i++) {
                    if (r.input[i] === r.sequence[i]) {
                        correctCount++;
                    }
                }
                if (isCorrect) {
                    currentStreak++;
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                } else {
                    currentStreak = 0;
                }
                totalReaction += r.time_ms;
            });
            accuracy = Math.round((correctCount / (replay.rounds.length * 3)) * 100);
            avgReaction = Math.round(totalReaction / replay.rounds.length);
        }

        $('#result-level').text(level);
        $('#result-rounds').text(totalRounds);
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(accuracy + '%');
        $('#result-badge').addClass('hidden');
        $('#modal-title').text(accuracy > 85 ? 'Strong Recall' : 'Keep Practicing');

        if (window.CerebroApp && CerebroApp.animateScore) {
            CerebroApp.animateScore(score);
        } else {
            $('#result-score').text(score);
        }
        if (window.CerebroApp && CerebroApp.setTierBadge) {
            CerebroApp.setTierBadge(score);
        }
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) {
            CerebroApp.updatePerformanceMeters({
                accuracy: accuracy,
                reaction: avgReaction,
                streak: maxStreak
            });
        }
        if (score > 2000 && window.CerebroApp && CerebroApp.spawnConfetti) {
            CerebroApp.spawnConfetti();
        }
        $('#modal-gameover').removeClass('hidden');
    }

    function saveScore() {
        if (!sessionToken) {
            console.warn('[PatternRecall] No session token — score not saved to server');
            return;
        }

        var payload = {
            token: sessionToken,
            score: score,
            level_reached: level,
            duration_ms: gameTimer.getElapsedMs(),
            replay: replay
        };

        CerebroAPI.post('/game/end', payload)
            .done(function (response) {
                console.log('[PatternRecall] Score saved:', response);
                if (response.personal_best) {
                    $('#result-badge').removeClass('hidden');
                }
            })
            .fail(function (err) {
                console.warn('[PatternRecall] Failed to save score:', err);
                // Queue for offline retry
                CerebroAPI.queueForRetry('POST', '/game/end', payload);
            });
    }

    // ══════════════════════════════════════════════════════
    // SCORING
    // ══════════════════════════════════════════════════════

    function calculateRoundScore() {
        var diff = getDifficulty(level);
        var seqLength = sequence.length;
        var difficultyMultiplier = 1.0 + (level * 0.15);
        var maxAllowedMs = diff.timeout;
        var reactionMs = roundTimer.getElapsedMs();
        var timeBonus = Math.max(0.5, 1.0 - (reactionMs / maxAllowedMs));

        return Math.round(BASE_POINTS * seqLength * difficultyMultiplier * timeBonus);
    }

    function showScorePopup(points) {
        var $popup = $('<div>')
            .addClass('score-popup')
            .text('+' + points)
            .appendTo('#game-area');

        setTimeout(function () {
            $popup.remove();
        }, 1100);
    }

    // ══════════════════════════════════════════════════════
    // DISPLAY UPDATES
    // ══════════════════════════════════════════════════════

    function updateDisplay() {
        $displayLevel.text('Lv.' + level);
        $displayRound.text('R' + round);
        $displayScore.text(score);
        updateLivesDisplay();
    }

    function updateLivesDisplay() {
        var html = '';
        for (var i = 0; i < 3; i++) {
            html += '<span class="heart' + (i >= lives ? ' lost' : '') + '">♥</span>';
        }
        $displayLives.html(html);
    }

    function setStatus(text, className) {
        var $status = $('#game-status');
        $status.removeClass('watching your-turn correct wrong');
        if (className) $status.addClass(className);
        $statusText.text(text);
    }

    function setTilesDisabled(disabled) {
        if (disabled) {
            $grid.find('.tile').addClass('disabled').removeClass('keyboard-focused');
        } else {
            $grid.find('.tile').removeClass('disabled');
            var gridSize = Math.round(Math.sqrt($grid.find('.tile').length));
            keyboardCursor = Math.min(keyboardCursor, gridSize * gridSize - 1);
            $grid.find('[data-index="' + keyboardCursor + '"]').addClass('keyboard-focused');
        }
    }

    // ══════════════════════════════════════════════════════
    // EVENT BINDING
    // ══════════════════════════════════════════════════════

    function bindEvents() {
        // Tile clicks (delegated)
        $grid.on('click', '.tile:not(.disabled)', function () {
            var index = parseInt($(this).attr('data-index'), 10);
            handleTileClick(index);
        });

        // Start button
        $('#btn-start-game').on('click', function () {
            startGame();
        });

        // Play again
        $('#btn-play-again').on('click', function () {
            $('#modal-gameover').addClass('hidden');
            startGame();
        });

        // Go home
        $('#btn-go-home').on('click', function () {
            $('#modal-gameover').addClass('hidden');
            if (typeof CerebroApp !== 'undefined') {
                CerebroApp.showView('dashboard');
            }
        });

        // Back button
        $('#btn-back').on('click', function () {
            if (state !== STATES.INIT && state !== STATES.GAME_OVER) {
                if (!confirm('Leave the game? Your progress will be lost.')) return;
            }
            cleanup();
            if (typeof CerebroApp !== 'undefined') {
                CerebroApp.showView('games');
            }
        });

        // Visibility change (tab away)
        $(document).on('visibilitychange.patternrecall', function () {
            if (document.hidden) {
                handleBlur();
            } else {
                handleFocus();
            }
        });

        // Keyboard: arrow keys to navigate cursor, Enter/Space to select, 1-9 for tiles
        $(document).on('keydown.patternrecall', function (e) {
            if (state !== STATES.INPUT) return;
            var totalTiles = $grid.find('.tile').length;
            if (totalTiles === 0) return;
            var gridSize = Math.round(Math.sqrt(totalTiles));

            $grid.find('.tile').removeClass('keyboard-focused');

            if (e.code === 'ArrowLeft') {
                e.preventDefault();
                if (keyboardCursor % gridSize > 0) keyboardCursor--;
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                if (keyboardCursor % gridSize < gridSize - 1) keyboardCursor++;
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                if (keyboardCursor >= gridSize) keyboardCursor -= gridSize;
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                if (keyboardCursor < totalTiles - gridSize) keyboardCursor += gridSize;
            } else if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                $grid.find('.tile').removeClass('keyboard-focused');
                handleTileClick(keyboardCursor);
                return;
            } else if (e.code >= 'Digit1' && e.code <= 'Digit9') {
                var idx = parseInt(e.code.charAt(5), 10) - 1;
                if (idx < totalTiles) {
                    e.preventDefault();
                    $grid.find('.tile').removeClass('keyboard-focused');
                    handleTileClick(idx);
                    return;
                }
            } else if (e.code >= 'Numpad1' && e.code <= 'Numpad9') {
                var idx = parseInt(e.code.charAt(6), 10) - 1;
                if (idx < totalTiles) {
                    e.preventDefault();
                    $grid.find('.tile').removeClass('keyboard-focused');
                    handleTileClick(idx);
                    return;
                }
            }

            $grid.find('[data-index="' + keyboardCursor + '"]').addClass('keyboard-focused');
        });
    }

    // ══════════════════════════════════════════════════════
    // VISIBILITY HANDLING
    // ══════════════════════════════════════════════════════

    function handleBlur() {
        if (state === STATES.SHOWING) {
            wasShowingWhenBlurred = true;
            // Void the current sequence display — player will get a re-show
        } else if (state === STATES.INPUT) {
            // Pause the timeout
            clearTimeout(inputTimeoutId);
            clearInterval(progressIntervalId);
            roundTimer.stop();
        }
    }

    function handleFocus() {
        if (wasShowingWhenBlurred) {
            wasShowingWhenBlurred = false;
            // Re-show the sequence from scratch
            setState(STATES.SHOWING);
        } else if (state === STATES.INPUT && !roundTimer.isRunning()) {
            // Resume input timeout
            roundTimer.start();
            startInputTimeout();
        }
    }

    // ══════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════

    function startGame() {
        resetGame();

        var diff = getDifficulty(1);
        buildGrid(diff.grid);
        gameTimer.reset().start();

        // Request session token from server
        CerebroAPI.post('/game/start', {
            game_slug: 'pattern-recall'
        })
            .done(function (response) {
                sessionToken = response.token;
                console.log('[PatternRecall] Session started:', response.token);
            })
            .fail(function (err) {
                console.warn('[PatternRecall] Could not start session (offline mode):', err);
                // Game still works — score just won't be saved to server
            });

        setState(STATES.COUNTDOWN);
    }

    function cleanup() {
        clearTimeout(inputTimeoutId);
        clearInterval(progressIntervalId);
        gameTimer.reset();
        roundTimer.reset();
        $(document).off('.patternrecall');
        $grid.find('.tile').removeClass('keyboard-focused');
        $grid.empty();
        $progressContainer.empty().addClass('hidden');
        setState(STATES.INIT);
    }

    function getState() {
        return {
            state: state,
            level: level,
            round: round,
            score: score,
            lives: lives
        };
    }

    // ══════════════════════════════════════════════════════
    // RETURN PUBLIC INTERFACE
    // ══════════════════════════════════════════════════════

    return {
        init: init,
        startGame: startGame,
        cleanup: cleanup,
        getState: getState,
        STATES: STATES
    };

})(jQuery);
