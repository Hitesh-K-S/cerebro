/**
 * Cerebro — Rapid Sort Game Engine
 *
 * Processing speed: classify items into two categories rapidly.
 */

'use strict';

var RapidSort = (function ($) {

    var STATES = {
        INIT: 'INIT', COUNTDOWN: 'COUNTDOWN', ROUND_INTRO: 'ROUND_INTRO',
        PLAYING: 'PLAYING', ROUND_END: 'ROUND_END', RESULTS: 'RESULTS'
    };

    var DIFFICULTY = [
        { displayMs: 2500, itemsPerRound: 8 },
        { displayMs: 2000, itemsPerRound: 10 },
        { displayMs: 1600, itemsPerRound: 10 },
        { displayMs: 1300, itemsPerRound: 12 },
        { displayMs: 1000, itemsPerRound: 12 },
    ];

    var CATEGORIES = [
        {
            left: 'Animal', right: 'Object',
            items: {
                left: ['Dog', 'Cat', 'Eagle', 'Shark', 'Rabbit', 'Horse', 'Tiger', 'Snake', 'Dolphin', 'Owl', 'Bear', 'Wolf'],
                right: ['Chair', 'Phone', 'Lamp', 'Clock', 'Hammer', 'Pencil', 'Mirror', 'Bottle', 'Wallet', 'Pillow', 'Book', 'Key']
            }
        },
        {
            left: 'Even', right: 'Odd',
            items: {
                left: ['2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24'],
                right: ['1', '3', '5', '7', '9', '11', '13', '15', '17', '19', '21', '23']
            }
        },
        {
            left: 'Fruit', right: 'Vegetable',
            items: {
                left: ['Apple', 'Banana', 'Mango', 'Grape', 'Cherry', 'Peach', 'Kiwi', 'Plum', 'Melon', 'Pear', 'Orange', 'Lemon'],
                right: ['Carrot', 'Potato', 'Onion', 'Tomato', 'Pepper', 'Celery', 'Corn', 'Pea', 'Garlic', 'Ginger', 'Turnip', 'Beet']
            }
        },
        {
            left: 'Hot', right: 'Cold',
            items: {
                left: ['Fire', 'Sun', 'Desert', 'Lava', 'Sauna', 'Summer', 'Chili', 'Oven', 'Torch', 'Coffee', 'Steam', 'Furnace'],
                right: ['Ice', 'Snow', 'Arctic', 'Winter', 'Glacier', 'Frost', 'Igloo', 'Freezer', 'Blizzard', 'Hail', 'Tundra', 'Sleet']
            }
        },
        {
            left: 'Big', right: 'Small',
            items: {
                left: ['Whale', 'Mountain', 'Planet', 'Ocean', 'Stadium', 'Skyscraper', 'Elephant', 'Galaxy', 'Continent', 'Castle'],
                right: ['Ant', 'Seed', 'Atom', 'Grain', 'Needle', 'Button', 'Crumb', 'Pixel', 'Pebble', 'Mite']
            }
        },
        {
            left: 'Nature', right: 'Man-Made',
            items: {
                left: ['River', 'Forest', 'Mountain', 'Cloud', 'Ocean', 'Thunder', 'Flower', 'Canyon', 'Volcano', 'Cave'],
                right: ['Bridge', 'Robot', 'Laptop', 'Highway', 'Satellite', 'Factory', 'Skyscraper', 'Airplane', 'Subway', 'Battery']
            }
        }
    ];

    var state = STATES.INIT;
    var level = 1, score = 0;
    var currentRound = 0, totalRounds = 6;
    var currentCategory = null;
    var roundItems = [];
    var currentItemIdx = -1;
    var itemTimeout = null;
    var roundCorrect = 0, roundWrong = 0, roundTimeouts = 0;
    var totalCorrect = 0, totalWrong = 0, totalTimeouts = 0;
    var roundStartTime = 0;
    var responded = false;
    var sessionToken = null;
    var gameTimer = CerebroTimer.create();
    var reactionTimer = CerebroTimer.create();
    var roundData = [];

    function getDifficulty(lvl) {
        return lvl <= DIFFICULTY.length ? DIFFICULTY[lvl - 1] : DIFFICULTY[DIFFICULTY.length - 1];
    }

    // ══════════════════════════════════════════════════════
    // ROUND GENERATION
    // ══════════════════════════════════════════════════════

    function prepareRound() {
        var diff = getDifficulty(level);
        // Pick category (cycle through, don't repeat consecutively)
        var catIdx;
        do {
            catIdx = Math.floor(Math.random() * CATEGORIES.length);
        } while (CATEGORIES[catIdx] === currentCategory && CATEGORIES.length > 1);

        currentCategory = CATEGORIES[catIdx];
        roundItems = [];

        var leftPool = currentCategory.items.left.slice();
        var rightPool = currentCategory.items.right.slice();

        // Shuffle both pools
        shuffle(leftPool);
        shuffle(rightPool);

        // Pick roughly equal from each side
        var leftCount = Math.ceil(diff.itemsPerRound / 2);
        var rightCount = diff.itemsPerRound - leftCount;

        for (var i = 0; i < leftCount && i < leftPool.length; i++) {
            roundItems.push({ word: leftPool[i], correct: 'left' });
        }
        for (var j = 0; j < rightCount && j < rightPool.length; j++) {
            roundItems.push({ word: rightPool[j], correct: 'right' });
        }

        shuffle(roundItems);
        currentItemIdx = -1;
        roundCorrect = roundWrong = roundTimeouts = 0;
    }

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
    }

    // ══════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════

    function buildUI() {
        var $c = $('#rp-container');
        if ($c.length === 0) { $c = $('<div id="rp-container"></div>').appendTo('#game-area'); }
        $('#pattern-grid').hide(); $('#game-start-screen').addClass('hidden');

        $c.html(
            '<div class="rp-round-banner" id="rp-banner">' +
            '  <h3 id="rp-round-label">Round 1 / 6</h3>' +
            '  <div class="round-cat" id="rp-cat-label"></div>' +
            '</div>' +
            '<div class="rp-item-display" id="rp-item-area">' +
            '  <div class="rp-item-word" id="rp-word">—</div>' +
            '</div>' +
            '<div class="rp-categories">' +
            '  <div class="rp-category-btn left" id="rp-btn-left">' +
            '    <span class="cat-label" id="rp-left-label">—</span>' +
            '    <span class="cat-key">← Arrow or Click</span>' +
            '  </div>' +
            '  <div class="rp-category-btn right" id="rp-btn-right">' +
            '    <span class="cat-label" id="rp-right-label">—</span>' +
            '    <span class="cat-key">→ Arrow or Click</span>' +
            '  </div>' +
            '</div>' +
            '<div class="rp-throughput" id="rp-throughput">Throughput: <span class="throughput-val">0.0</span> items/sec</div>'
        ).show();
    }

    function showRoundIntro(callback) {
        state = STATES.ROUND_INTRO;
        $('#rp-round-label').text('Round ' + (currentRound + 1) + ' / ' + totalRounds);
        $('#rp-cat-label').html(
            '<strong>' + currentCategory.left + '</strong> ← → <strong>' + currentCategory.right + '</strong>'
        );
        $('#rp-left-label').text(currentCategory.left);
        $('#rp-right-label').text(currentCategory.right);
        $('#rp-word').text('Get Ready!').removeClass('correct wrong');

        setTimeout(callback, 2000);
    }

    function showItem(item) {
        var $word = $('#rp-word');
        $word.text(item.word).removeClass('correct wrong');
        // Force animation restart
        $word[0].offsetWidth;
        $word.css('animation', 'none');
        $word[0].offsetWidth;
        $word.css('animation', '');
    }

    // ══════════════════════════════════════════════════════
    // GAMEPLAY
    // ══════════════════════════════════════════════════════

    function nextItem() {
        currentItemIdx++;
        if (currentItemIdx >= roundItems.length) {
            endRound();
            return;
        }

        responded = false;
        var item = roundItems[currentItemIdx];
        showItem(item);
        reactionTimer.reset().start();

        // Item timeout
        var diff = getDifficulty(level);
        clearTimeout(itemTimeout);
        itemTimeout = setTimeout(function () {
            if (!responded) handleTimeout();
        }, diff.displayMs);

        $('.rp-category-btn').removeClass('flash-correct flash-wrong');
    }

    function handleChoice(side) {
        if (state !== STATES.PLAYING || responded) return;
        responded = true;
        clearTimeout(itemTimeout);
        reactionTimer.stop();

        var item = roundItems[currentItemIdx];
        var correct = (side === item.correct);
        var reactionMs = reactionTimer.getElapsedMs();
        var diff = getDifficulty(level);

        var $btn = side === 'left' ? $('#rp-btn-left') : $('#rp-btn-right');

        if (correct) {
            roundCorrect++;
            totalCorrect++;
            var timeBonus = Math.pow(Math.max(0.2, 1.0 - (reactionMs / diff.displayMs)), 1.5);
            score += Math.round(100 * timeBonus);
            $btn.addClass('flash-correct');
            $('#rp-word').addClass('correct');
        } else {
            roundWrong++;
            totalWrong++;
            score -= 50;
            $btn.addClass('flash-wrong');
            $('#rp-word').addClass('wrong');
        }

        score = Math.max(0, score);
        updateDisplay();
        updateThroughput();

        setTimeout(nextItem, 350);
    }

    function handleTimeout() {
        responded = true;
        roundTimeouts++;
        totalTimeouts++;
        score -= 25;
        score = Math.max(0, score);
        $('#rp-word').addClass('wrong');
        updateDisplay();
        setTimeout(nextItem, 400);
    }

    function startRound() {
        prepareRound();
        showRoundIntro(function () {
            state = STATES.PLAYING;
            roundStartTime = performance.now();
            setStatus('Classify each item!', 'your-turn');
            nextItem();
        });
    }

    function endRound() {
        state = STATES.ROUND_END;
        clearTimeout(itemTimeout);

        // Round bonus
        if (roundCorrect === roundItems.length) {
            score += 200;
        } else if (roundCorrect / roundItems.length >= 0.8) {
            score += 100;
        }

        roundData.push({
            category: currentCategory.left + '/' + currentCategory.right,
            correct: roundCorrect, total: roundItems.length, wrong: roundWrong
        });

        updateDisplay();

        var $word = $('#rp-word');
        $word.text(roundCorrect + '/' + roundItems.length + ' correct!').removeClass('correct wrong');

        currentRound++;

        setTimeout(function () {
            if (currentRound >= totalRounds) {
                endGame();
            } else {
                if (currentRound % 2 === 0 && level < DIFFICULTY.length) level++;
                startRound();
            }
        }, 1500);
    }

    function updateThroughput() {
        var elapsed = (performance.now() - roundStartTime) / 1000;
        if (elapsed > 0) {
            var throughput = (totalCorrect / ((gameTimer.getElapsedMs()) / 1000)).toFixed(2);
            $('#rp-throughput .throughput-val').text(throughput);
        }
    }

    // ══════════════════════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════════════════════

    function startGame() {
        score = 0; level = 1; currentRound = 0;
        totalCorrect = totalWrong = totalTimeouts = 0;
        roundData = []; sessionToken = null;
        gameTimer.reset().start();
        buildUI();

        CerebroAPI.post('/game/start', { game_slug: 'rapid-sort' })
            .done(function (r) { sessionToken = r.token; }).fail(function () { });

        updateDisplay();
        runCountdown(function () { startRound(); });
    }

    function endGame() {
        state = STATES.RESULTS;
        gameTimer.stop();
        clearTimeout(itemTimeout);

        var totalItems = totalCorrect + totalWrong + totalTimeouts;
        var throughput = (totalCorrect / (gameTimer.getElapsedMs() / 1000)).toFixed(2);

        score += Math.round(parseFloat(throughput) * 50);

        $('#result-score').text(score);
        $('#result-level').text(level);
        $('#result-rounds').text(totalCorrect + '/' + totalItems + ' correct');
        $('#result-time').text(throughput + ' items/sec');
        var title = parseFloat(throughput) > 1.5 ? 'Lightning Fast! ⚡' :
            parseFloat(throughput) > 1.0 ? 'Quick Thinker! 🚀' : 'Keep Practicing! 🏃';
        $('#modal-title').text(title);
        $('#result-badge').addClass('hidden');
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            CerebroAPI.post('/game/end', {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: {
                    rounds: roundData.map(function (r) {
                        return { sequence: [r.category], input: [r.correct], time_ms: 0 };
                    })
                }
            }).fail(function () { });
        }
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
        if (cls) $s.addClass(cls); $('#status-text').text(t);
    }

    function updateDisplay() {
        $('#display-level').text('Level ' + level);
        $('#display-round').text('Round ' + (currentRound + 1) + '/' + totalRounds);
        $('#display-score').text('Score: ' + score);
    }

    function bindEvents() {
        $(document).off('.rapidsort');
        $(document).on('click.rapidsort', '#rp-btn-left', function () { handleChoice('left'); });
        $(document).on('click.rapidsort', '#rp-btn-right', function () { handleChoice('right'); });

        $(document).on('keydown.rapidsort', function (e) {
            if (state !== STATES.PLAYING || responded) return;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); handleChoice('left'); }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); handleChoice('right'); }
        });
    }

    function init() { bindEvents(); }

    function cleanup() {
        clearTimeout(itemTimeout);
        $(document).off('.rapidsort');
        $('#rp-container').remove(); $('#pattern-grid').show();
        state = STATES.INIT;
    }

    return {
        slug: 'rapid-sort', name: 'Rapid Sort', category: 'speed',
        init: init, startGame: startGame, cleanup: cleanup,
        getState: function () { return { state: state, score: score }; }, STATES: STATES
    };
})(jQuery);
