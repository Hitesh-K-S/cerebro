/**
 * Cerebro — Rule Shifter Game Engine
 *
 * Cognitive flexibility: sort cards by a silently-changing rule.
 */

'use strict';

var RuleShifter = (function ($) {

    var STATES = {
        INIT: 'INIT', INSTRUCTIONS: 'INSTRUCTIONS', COUNTDOWN: 'COUNTDOWN',
        PLAYING: 'PLAYING', PAUSE: 'PAUSE', RESULTS: 'RESULTS'
    };

    var RULES = ['color', 'shape', 'count'];
    var COLORS = ['red', 'blue', 'green', 'yellow'];
    var SHAPES = ['circle', 'square', 'triangle', 'diamond'];
    var COUNTS = [1, 2, 3, 4];

    var DIFFICULTY = [
        { rules: 2, bins: 2, shiftAfter: 8 },
        { rules: 2, bins: 3, shiftAfter: 7 },
        { rules: 3, bins: 3, shiftAfter: 6 },
        { rules: 3, bins: 3, shiftAfter: 5 },
        { rules: 3, bins: 4, shiftAfter: 4 },
    ];

    var GAME_DURATION = 60000;

    var state = STATES.INIT;
    var level = 1;
    var score = 0;
    var activeRule = '';
    var previousRule = '';
    var streak = 0;
    var shiftsCompleted = 0;
    var shiftsDetected = 0;
    var totalCards = 0;
    var correctCount = 0;
    var errorCount = 0;
    var perseverativeErrors = 0;
    var postShift = false;
    var postShiftCorrect = 0;
    var cardsAfterShift = 0;
    var currentCard = null;
    var binCards = [];
    var gameTimerInterval = null;
    var gameTimeRemaining = GAME_DURATION;
    var gameTimer = CerebroTimer.create();
    var sessionToken = null;
    var sortData = [];

    function getDifficulty(lvl) {
        return lvl <= DIFFICULTY.length ? DIFFICULTY[lvl - 1] : DIFFICULTY[DIFFICULTY.length - 1];
    }

    // ══════════════════════════════════════════════════════
    // CARD GENERATION
    // ══════════════════════════════════════════════════════

    function makeCard() {
        return {
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
            count: COUNTS[Math.floor(Math.random() * COUNTS.length)]
        };
    }

    function generateBinCards(diff) {
        binCards = [];
        for (var i = 0; i < diff.bins; i++) {
            binCards.push(makeCard());
        }
    }

    function getCorrectBin(card) {
        // Find which bin matches based on the active rule
        for (var i = 0; i < binCards.length; i++) {
            if (card[activeRule] === binCards[i][activeRule]) return i;
        }
        return -1; // No match — shouldn't happen with proper card generation
    }

    function generateCard() {
        // Generate a card that has at least one matching bin
        var maxAttempts = 50;
        for (var a = 0; a < maxAttempts; a++) {
            var card = makeCard();
            if (getCorrectBin(card) >= 0) return card;
        }
        // Fallback: copy an attribute from a bin card
        var card = makeCard();
        card[activeRule] = binCards[0][activeRule];
        return card;
    }

    function selectRule(diff) {
        var available = RULES.slice(0, diff.rules);
        var newRule;
        do {
            newRule = available[Math.floor(Math.random() * available.length)];
        } while (newRule === activeRule);
        previousRule = activeRule;
        activeRule = newRule;
    }

    // ══════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════

    function renderCardHTML(card, small) {
        var sizeClass = small ? 'style="width:20px;height:20px;"' : '';
        var html = '<div class="rs-shape-row">';
        for (var i = 0; i < card.count; i++) {
            html += '<div class="rs-shape ' + card.shape + ' color-' + card.color + '" ' + sizeClass + '></div>';
        }
        html += '</div>';
        return html;
    }

    function buildUI() {
        var $custom = $('#rs-container');
        if ($custom.length === 0) {
            $custom = $('<div id="rs-container"></div>').appendTo('#game-area');
        }
        $('#pattern-grid').hide();
        $('#game-start-screen').addClass('hidden');

        $custom.html(
            '<div class="rs-timer" id="rs-timer">60.0s</div>' +
            '<div class="rs-card" id="rs-current-card"></div>' +
            '<div class="rs-streak-meter"><div class="rs-streak-fill" id="rs-streak"></div></div>' +
            '<div class="rs-bins" id="rs-bins"></div>' +
            '<div class="rs-stats">' +
            '  <span>Correct: <span class="stat-val" id="rs-correct">0</span></span>' +
            '  <span>Errors: <span class="stat-val" id="rs-errors">0</span></span>' +
            '  <span>Shifts: <span class="stat-val" id="rs-shifts">0</span></span>' +
            '</div>'
        ).show();
    }

    function renderCurrentCard() {
        var $c = $('#rs-current-card');
        $c.html(renderCardHTML(currentCard)).removeClass('correct-feedback wrong-feedback');
    }

    function renderBins() {
        var $bins = $('#rs-bins');
        $bins.empty();
        binCards.forEach(function (bc, idx) {
            var $bin = $('<div class="rs-bin" data-bin="' + idx + '"></div>');
            $bin.html(renderCardHTML(bc, true) + '<div class="rs-bin-label">Bin ' + (idx + 1) + '</div>');
            $bins.append($bin);
        });
    }

    function updateStreakMeter(diff) {
        var pct = Math.min(100, (streak / diff.shiftAfter) * 100);
        $('#rs-streak').css('width', pct + '%');
    }

    function showFeedback(correct) {
        var $c = $('#rs-current-card');
        $c.append('<span class="feedback-icon">' + (correct ? '✓' : '✗') + '</span>');
        $c.addClass(correct ? 'correct-feedback' : 'wrong-feedback');
    }

    // ══════════════════════════════════════════════════════
    // SORT HANDLING
    // ══════════════════════════════════════════════════════

    function handleSort(binIndex) {
        if (state !== STATES.PLAYING || !currentCard) return;
        state = 'PROCESSING'; // Prevent double clicks

        var correct = (binIndex === getCorrectBin(currentCard));
        totalCards++;
        showFeedback(correct);

        if (correct) {
            correctCount++;
            streak++;
            score += postShift ? 150 : 50;

            if (postShift) {
                postShiftCorrect++;
                cardsAfterShift++;
                if (postShiftCorrect >= 2) {
                    shiftsDetected++;
                    postShift = false;
                }
            }

            var diff = getDifficulty(level);
            updateStreakMeter(diff);

            // Check for rule shift
            if (streak >= diff.shiftAfter) {
                triggerShift();
            }
        } else {
            errorCount++;
            streak = 0;

            // Check perseverative error
            if (previousRule && currentCard[previousRule] === binCards[binIndex][previousRule]) {
                perseverativeErrors++;
                score -= 30;
            }

            if (postShift) cardsAfterShift++;
            updateStreakMeter(getDifficulty(level));
        }

        sortData.push({ binId: binIndex, correct: correct });
        score = Math.max(0, score);
        updateStats();

        setTimeout(function () {
            state = STATES.PLAYING;
            nextCard();
        }, 600);
    }

    function triggerShift() {
        streak = 0;
        shiftsCompleted++;
        selectRule(getDifficulty(level));
        postShift = true;
        postShiftCorrect = 0;
        cardsAfterShift = 0;
        score += 200;
        updateStats();
        // No visual cue — player must figure it out
    }

    function nextCard() {
        currentCard = generateCard();
        renderCurrentCard();
    }

    // ══════════════════════════════════════════════════════
    // GAME LIFECYCLE
    // ══════════════════════════════════════════════════════

    function startGame() {
        score = 0; level = 1; streak = 0;
        correctCount = errorCount = perseverativeErrors = 0;
        shiftsCompleted = shiftsDetected = totalCards = 0;
        postShift = false;
        sortData = [];
        gameTimeRemaining = GAME_DURATION;
        sessionToken = null;
        activeRule = ''; previousRule = '';

        var diff = getDifficulty(level);
        selectRule(diff);
        generateBinCards(diff);

        buildUI();
        renderBins();

        CerebroAPI.post('/game/start', { game_slug: 'rule-shifter' })
            .done(function (r) { sessionToken = r.token; }).fail(function () { });

        updateDisplay();

        runCountdown(function () {
            state = STATES.PLAYING;
            setStatus('Sort the card into a bin', 'your-turn');
            nextCard();
            startGameTimer();
        });
    }

    function startGameTimer() {
        var $timer = $('#rs-timer');
        clearInterval(gameTimerInterval);
        gameTimer.reset().start();

        gameTimerInterval = setInterval(function () {
            gameTimeRemaining -= 100;
            var secs = Math.max(0, gameTimeRemaining / 1000);
            $timer.text(secs.toFixed(1) + 's');
            if (secs <= 10) $timer.addClass('urgent');
            if (gameTimeRemaining <= 0) {
                clearInterval(gameTimerInterval);
                endGame();
            }
        }, 100);
    }

    function endGame() {
        state = STATES.RESULTS;
        gameTimer.stop();
        clearInterval(gameTimerInterval);

        $('#result-score').text(score);
        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + totalCards + ' correct');
        $('#result-time').text(gameTimer.getFormatted());
        $('#modal-title').text(shiftsDetected > 2 ? 'Adaptable Mind! 🔄' : 'Keep Adapting! 🧩');
        $('#result-badge').addClass('hidden');
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            CerebroAPI.post('/game/end', {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: {
                    rounds: [{
                        sequence: sortData.map(function (s) { return s.binId; }),
                        input: sortData.map(function (s) { return s.binId; }), time_ms: gameTimer.getElapsedMs()
                    }]
                }
            }).fail(function () { });
        }
    }

    function updateStats() {
        $('#rs-correct').text(correctCount);
        $('#rs-errors').text(errorCount);
        $('#rs-shifts').text(shiftsDetected);
    }

    // ══════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════

    function runCountdown(cb) {
        var $o = $('#countdown-overlay'), $n = $('#countdown-number'), c = 3;
        $o.removeClass('hidden'); $n.text(c);
        var iv = setInterval(function () {
            c--; if (c > 0) { $n.text(c); } else { clearInterval(iv); $o.addClass('hidden'); cb(); }
        }, 1000);
    }

    function setStatus(t, cls) {
        var $s = $('#game-status');
        $s.removeClass('watching your-turn correct wrong');
        if (cls) $s.addClass(cls);
        $('#status-text').text(t);
    }

    function updateDisplay() {
        $('#display-level').text('Level ' + level);
        $('#display-round').text('Cards: ' + totalCards);
        $('#display-score').text('Score: ' + score);
    }

    function bindEvents() {
        $(document).off('.ruleshifter');
        $(document).on('click.ruleshifter', '.rs-bin', function () {
            handleSort(parseInt($(this).attr('data-bin'), 10));
        });
    }

    function init() { bindEvents(); }

    function cleanup() {
        clearInterval(gameTimerInterval);
        $(document).off('.ruleshifter');
        $('#rs-container').remove();
        $('#pattern-grid').show();
        state = STATES.INIT;
    }

    return {
        slug: 'rule-shifter', name: 'Rule Shifter', category: 'logic',
        init: init, startGame: startGame, cleanup: cleanup,
        getState: function () { return { state: state, score: score }; }, STATES: STATES
    };
})(jQuery);
