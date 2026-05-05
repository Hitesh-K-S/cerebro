/**
 * Cerebro — Signal Hunter Game Engine
 *
 * Selective attention: find targets among distractors.
 */

'use strict';

var SignalHunter = (function ($) {

    var STATES = {
        INIT: 'INIT', INSTRUCTIONS: 'INSTRUCTIONS', TARGET_REVEAL: 'TARGET_REVEAL',
        PLAYING: 'PLAYING', ROUND_TRANSITION: 'ROUND_TRANSITION', RESULTS: 'RESULTS'
    };

    var DIFFICULTY = [
        { fieldSize: 30, targets: 4, time: 15000, pool: 'easy' },
        { fieldSize: 40, targets: 5, time: 14000, pool: 'easy' },
        { fieldSize: 50, targets: 6, time: 12000, pool: 'medium' },
        { fieldSize: 60, targets: 7, time: 11000, pool: 'hard' },
        { fieldSize: 70, targets: 8, time: 10000, pool: 'hard' },
    ];

    var SYMBOL_SETS = {
        easy: { pairs: [['T', 'I', 'L', 'F', '7', '1'], ['O', 'Q', 'D', 'C', '0', 'G'], ['M', 'N', 'W', 'H', 'K', 'R']] },
        medium: { pairs: [['b', 'd', 'p', 'q', '6', '9'], ['E', 'F', 'B', '8', '3', 'S'], ['Z', '2', '5', 'S', '7', '1']] },
        hard: { pairs: [['ø', 'θ', 'ö', 'o', '0', 'Ø'], ['l', 'I', '1', '|', '!', 'i'], ['n', 'h', 'm', 'u', 'r', 'v']] }
    };

    var state = STATES.INIT;
    var level = 1;
    var score = 0;
    var currentRound = 0;
    var totalRounds = 6;
    var roundTimer = null;
    var roundTimerInterval = null;
    var gameTimer = CerebroTimer.create();
    var sessionToken = null;

    // Round data
    var targetSymbol = '';
    var fieldSymbols = [];
    var targetPositions = [];
    var foundCount = 0;
    var distractorsTapped = 0;
    var roundData = [];

    function getDifficulty(lvl) {
        return lvl <= DIFFICULTY.length ? DIFFICULTY[lvl - 1] : DIFFICULTY[DIFFICULTY.length - 1];
    }

    // ══════════════════════════════════════════════════════
    // FIELD GENERATION
    // ══════════════════════════════════════════════════════

    function generateField(diff) {
        var poolKey = diff.pool;
        var pairs = SYMBOL_SETS[poolKey].pairs;
        var pair = pairs[currentRound % pairs.length];
        targetSymbol = pair[0];
        var distractors = pair.slice(1);

        fieldSymbols = [];
        targetPositions = [];

        // Place targets
        for (var i = 0; i < diff.targets; i++) {
            fieldSymbols.push({ symbol: targetSymbol, isTarget: true });
        }

        // Fill rest with distractors
        for (var j = fieldSymbols.length; j < diff.fieldSize; j++) {
            var d = distractors[Math.floor(Math.random() * distractors.length)];
            fieldSymbols.push({ symbol: d, isTarget: false });
        }

        // Shuffle
        for (var k = fieldSymbols.length - 1; k > 0; k--) {
            var r = Math.floor(Math.random() * (k + 1));
            var tmp = fieldSymbols[k];
            fieldSymbols[k] = fieldSymbols[r];
            fieldSymbols[r] = tmp;
        }
    }

    // ══════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════

    function buildUI() {
        var $custom = $('#sh-container');
        if ($custom.length === 0) {
            $custom = $('<div id="sh-container"></div>').appendTo('#game-area');
        }
        $('#pattern-grid').hide();
        $('#game-start-screen').addClass('hidden');

        $custom.html(
            '<div class="round-timer-display" id="sh-timer">—</div>' +
            '<div class="target-preview" id="sh-preview">' +
            '  <div class="target-label">Find all:</div>' +
            '  <div class="target-symbol" id="sh-target">—</div>' +
            '</div>' +
            '<div class="signal-field" id="sh-field"></div>' +
            '<div class="found-counter" id="sh-counter">0 / 0 found</div>'
        ).show();
    }

    function renderField(diff) {
        var $field = $('#sh-field');
        $field.empty();

        var fieldW = $field.width() - 40;
        var fieldH = $field.height() - 40;
        var cols = Math.ceil(Math.sqrt(diff.fieldSize * (fieldW / fieldH)));
        var rows = Math.ceil(diff.fieldSize / cols);
        var cellW = fieldW / cols;
        var cellH = fieldH / rows;

        fieldSymbols.forEach(function (item, idx) {
            var row = Math.floor(idx / cols);
            var col = idx % cols;
            // Add jitter for organic feel
            var jitterX = (Math.random() - 0.5) * cellW * 0.3;
            var jitterY = (Math.random() - 0.5) * cellH * 0.3;
            var x = 20 + col * cellW + cellW / 2 - 18 + jitterX;
            var y = 20 + row * cellH + cellH / 2 - 18 + jitterY;

            var $sym = $('<div class="signal-symbol"></div>')
                .text(item.symbol)
                .attr('data-idx', idx)
                .attr('data-target', item.isTarget ? '1' : '0')
                .css({ left: x + 'px', top: y + 'px' });
            $field.append($sym);

            if (item.isTarget) targetPositions.push(idx);
        });
    }

    function showTargetPreview(callback) {
        $('#sh-preview').show();
        $('#sh-target').text(targetSymbol);
        $('#sh-field').css('opacity', 0.3);

        setTimeout(function () {
            $('#sh-preview').hide();
            $('#sh-field').css('opacity', 1);
            callback();
        }, 2000);
    }

    // ══════════════════════════════════════════════════════
    // ROUND MANAGEMENT
    // ══════════════════════════════════════════════════════

    function startRound() {
        var diff = getDifficulty(level);
        foundCount = 0;
        distractorsTapped = 0;
        generateField(diff);
        renderField(diff);
        updateCounter(diff);

        showTargetPreview(function () {
            state = STATES.PLAYING;
            setStatus('Find all ' + targetSymbol, 'your-turn');
            startRoundTimer(diff.time);
        });
    }

    function startRoundTimer(ms) {
        var remaining = ms;
        var $timer = $('#sh-timer');
        $timer.text((remaining / 1000).toFixed(1) + 's').removeClass('urgent');

        clearInterval(roundTimerInterval);
        roundTimerInterval = setInterval(function () {
            remaining -= 100;
            $timer.text((Math.max(0, remaining) / 1000).toFixed(1) + 's');
            if (remaining <= 3000) $timer.addClass('urgent');
            if (remaining <= 0) {
                clearInterval(roundTimerInterval);
                endRound(false);
            }
        }, 100);
    }

    function endRound(allFound) {
        clearInterval(roundTimerInterval);
        state = STATES.ROUND_TRANSITION;

        var diff = getDifficulty(level);
        // Highlight missed targets
        if (!allFound) {
            $('#sh-field .signal-symbol[data-target="1"]').not('.found').addClass('missed');
        }

        // Score this round
        var totalTaps = foundCount + distractorsTapped;
        var speedMult = allFound ? 1.5 : 1.0;
        var accBonus = totalTaps > 0 ? 1.0 + 0.5 * (1 - distractorsTapped / totalTaps) : 1.0;
        var roundScore = Math.round(
            (foundCount / diff.targets) * 100 * speedMult * accBonus - (distractorsTapped * 50)
        );
        roundScore = Math.max(0, roundScore);
        score += roundScore;

        roundData.push({
            target: targetSymbol,
            found: foundCount,
            total: diff.targets,
            errors: distractorsTapped,
            round_score: roundScore
        });

        updateDisplay();
        setStatus(allFound ? 'All found! +' + roundScore : 'Round over. +' + roundScore, allFound ? 'correct' : 'watching');

        setTimeout(function () {
            currentRound++;
            if (currentRound >= totalRounds) {
                endGame();
            } else {
                // Increase level every 2 rounds
                if (currentRound % 2 === 0 && level < DIFFICULTY.length) level++;
                startRound();
            }
        }, 1500);
    }

    function handleSymbolClick(idx) {
        if (state !== STATES.PLAYING) return;
        var $sym = $('#sh-field .signal-symbol[data-idx="' + idx + '"]');
        if ($sym.hasClass('found') || $sym.hasClass('wrong-tap')) return;

        if ($sym.attr('data-target') === '1') {
            foundCount++;
            $sym.addClass('found');
            var diff = getDifficulty(level);
            updateCounter(diff);
            if (foundCount >= diff.targets) endRound(true);
        } else {
            distractorsTapped++;
            $sym.addClass('wrong-tap');
            setTimeout(function () { $sym.removeClass('wrong-tap'); }, 400);
        }
    }

    function updateCounter(diff) {
        $('#sh-counter').html('<strong>' + foundCount + '</strong> / ' + diff.targets + ' found');
    }

    // ══════════════════════════════════════════════════════
    // GAME LIFECYCLE
    // ══════════════════════════════════════════════════════

    function startGame() {
        score = 0; level = 1; currentRound = 0;
        roundData = []; sessionToken = null;
        gameTimer.reset().start();
        buildUI();

        CerebroAPI.post('/game/start', { game_slug: 'signal-hunter' })
            .done(function (r) { sessionToken = r.token; }).fail(function () { });

        updateDisplay();
        runCountdown(function () { startRound(); });
    }

    function endGame() {
        state = STATES.RESULTS;
        gameTimer.stop();
        var totalTargets = roundData.reduce(function (s, r) { return s + r.total; }, 0);
        var totalFound = roundData.reduce(function (s, r) { return s + r.found; }, 0);

        $('#result-score').text(score);
        $('#result-level').text(level);
        $('#result-rounds').text(totalFound + '/' + totalTargets + ' found');
        $('#result-time').text(gameTimer.getFormatted());
        $('#modal-title').text(totalFound / totalTargets > 0.85 ? 'Sharp Eyes! 🎯' : 'Good Effort! 👀');
        $('#result-badge').addClass('hidden');
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            CerebroAPI.post('/game/end', {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: {
                    rounds: roundData.map(function (r) {
                        return { sequence: [r.target], input: [r.found], time_ms: 0 };
                    })
                }
            }).fail(function () { });
        }
    }

    function runCountdown(cb) {
        var $o = $('#countdown-overlay'), $n = $('#countdown-number'), c = 3;
        $o.removeClass('hidden'); $n.text(c);
        var iv = setInterval(function () {
            c--; if (c > 0) { $n.text(c); } else { clearInterval(iv); $o.addClass('hidden'); cb(); }
        }, 1000);
    }

    function setStatus(t, c) {
        var $s = $('#game-status');
        $s.removeClass('watching your-turn correct wrong');
        if (c) $s.addClass(c);
        $('#status-text').text(t);
    }

    function updateDisplay() {
        $('#display-level').text('Level ' + level);
        $('#display-round').text('Round ' + (currentRound + 1) + '/' + totalRounds);
        $('#display-score').text('Score: ' + score);
    }

    function bindEvents() {
        $(document).off('.signalhunter');
        $(document).on('click.signalhunter', '.signal-symbol', function () {
            handleSymbolClick(parseInt($(this).attr('data-idx'), 10));
        });
    }

    function init() { bindEvents(); }

    function cleanup() {
        clearInterval(roundTimerInterval);
        $(document).off('.signalhunter');
        $('#sh-container').remove();
        $('#pattern-grid').show();
        state = STATES.INIT;
    }

    return {
        slug: 'signal-hunter', name: 'Signal Hunter', category: 'attention',
        init: init, startGame: startGame, cleanup: cleanup,
        getState: function () { return { state: state, score: score }; }, STATES: STATES
    };
})(jQuery);
