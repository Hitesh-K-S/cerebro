/**
 * Cerebro — Word Grid Game Engine
 */

'use strict';

var WordGrid = (function ($) {

    var STATES = {
        INIT: 'INIT', COUNTDOWN: 'COUNTDOWN', SHOWING: 'SHOWING',
        INPUT: 'INPUT', FEEDBACK: 'FEEDBACK', GAME_OVER: 'GAME_OVER'
    };

    var BASE_POINTS = 100;
    var COUNTDOWN_SECONDS = 3;
    var ROUND_DELAY = 1000;
    var TOTAL_ROUNDS = 12;

    var WORD_POOLS = {
        animals: ['Dog', 'Cat', 'Bear', 'Wolf', 'Deer', 'Fox', 'Owl', 'Hawk', 'Lion', 'Tiger',
                   'Elk', 'Mole', 'Seal', 'Dove', 'Crab', 'Frog', 'Hare', 'Lynx', 'Moth', 'Newt'],
        food: ['Apple', 'Bread', 'Cake', 'Rice', 'Soup', 'Fish', 'Milk', 'Eggs', 'Bean', 'Plum',
               'Corn', 'Pear', 'Lime', 'Peas', 'Tofu', 'Figs', 'Veal', 'Tuna', 'Oats'],
        objects: ['Chair', 'Table', 'Lamp', 'Clock', 'Book', 'Vase', 'Shelf', 'Desk', 'Bowl', 'Knife',
                  'Rope', 'Drum', 'Bell', 'Fork', 'Grid', 'Bead', 'Clip', 'Cord', 'Disc', 'Plug'],
        places: ['Park', 'Cave', 'Lake', 'Wood', 'Hill', 'Port', 'Coast', 'Plain', 'Ridge', 'Valley',
                 'Dune', 'Glen', 'Peak', 'Ford', 'Meadow', 'Grove', 'Creek', 'Bluff', 'Haven', 'Quay'],
        colors: ['Red', 'Blue', 'Gold', 'Pink', 'Lime', 'Teal', 'Coral', 'Mint', 'Plum', 'Slate',
                 'Navy', 'Rose', 'Lace', 'Sage', 'Ruby', 'Jade', 'Snow', 'Clay', 'Bark', 'Mist']
    };

    var DIFFICULTY = [
        { grid: 3, words: 6, flashMs: 3000, distractors: 1 },
        { grid: 3, words: 6, flashMs: 2500, distractors: 2 },
        { grid: 4, words: 10, flashMs: 2500, distractors: 3 },
        { grid: 4, words: 10, flashMs: 2000, distractors: 4 },
        { grid: 5, words: 15, flashMs: 2000, distractors: 5 },
    ];

    var EXTENDED = { grid: 5, words: 18, flashMs: 1500, distractors: 6 };
    var POOL_NAMES = Object.keys(WORD_POOLS);

    var state = STATES.INIT;
    var level = 1, round = 1, score = 0;
    var correctCount = 0, wrongCount = 0;
    var gridWords = [], targetWord = '', isPresent = false, responded = false;
    var sessionToken = null, gameTimer = null;
    var poolUsed = [], roundData = [];
    var showTimeoutId = null, nextRoundTimeoutId = null;

    var $grid, $countdownOverlay, $countdownNumber;
    var $statusText, $startScreen;
    var $displayLevel, $displayRound, $displayScore;

    function cacheDom() {
        $grid = $('#game-board');
        $countdownOverlay = $('#countdown-overlay');
        $countdownNumber = $('#countdown-number');
        $statusText = $('#status-text');
        $startScreen = $('#game-start-screen');
        $displayLevel = $('#display-level');
        $displayRound = $('#display-round');
        $displayScore = $('#display-score');
    }

    function getDifficulty(lvl) {
        if (lvl <= DIFFICULTY.length) return DIFFICULTY[lvl - 1];
        var extra = lvl - DIFFICULTY.length;
        return {
            grid: EXTENDED.grid,
            words: Math.min(EXTENDED.words + extra * 2, 25),
            flashMs: Math.max(EXTENDED.flashMs - extra * 100, 800),
            distractors: Math.min(EXTENDED.distractors + extra, 10)
        };
    }

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
    }

    function pickWordPool() {
        var available = POOL_NAMES.filter(function (p) { return poolUsed.indexOf(p) === -1; });
        if (available.length === 0) { poolUsed = []; available = POOL_NAMES.slice(); }
        var pick = available[Math.floor(Math.random() * available.length)];
        poolUsed.push(pick);
        return WORD_POOLS[pick];
    }

    function getWords(count) {
        var pool = pickWordPool();
        return shuffle(pool.slice()).slice(0, count);
    }

    function setState(newState) {
        state = newState;
        switch (newState) {
            case STATES.COUNTDOWN: runCountdown(); break;
            case STATES.SHOWING: showGrid(); break;
            case STATES.GAME_OVER: endGame(); break;
        }
    }

    function init() { cacheDom(); bindEvents(); state = STATES.INIT; }

    function resetGame() {
        level = 1; round = 1; score = 0; correctCount = 0; wrongCount = 0;
        poolUsed = []; roundData = []; sessionToken = null;
        clearTimeout(showTimeoutId); clearTimeout(nextRoundTimeoutId);
        if (gameTimer) gameTimer.reset();
    }

    function buildUI() {
        $grid.empty().addClass('wg-grid grid-3');
        // Word tiles come first (rebuilt each round)
        // Static UI below word tiles
        var html =
            '<div class="wg-target-row" id="wg-ui-area">' +
                '<span class="wg-target-label">Was this word in the grid?</span>' +
                '<div class="wg-target-word memory-category" id="wg-target-word">---</div>' +
            '</div>' +
            '<div class="wg-buttons" id="wg-btn-row">' +
                '<button class="wg-btn wg-btn-yes" id="wg-btn-yes" type="button">Yes</button>' +
                '<button class="wg-btn wg-btn-no" id="wg-btn-no" type="button">No</button>' +
            '</div>' +
            '<div class="wg-feedback" id="wg-feedback"></div>' +
            '<div class="wg-progress-dots" id="wg-dots"></div>';
        $grid.append(html);
    }

    function updateProgressDots() {
        var $dots = $('#wg-dots');
        $dots.empty();
        for (var i = 0; i < TOTAL_ROUNDS; i++) {
            var cls = 'wg-dot';
            if (i < roundData.length) cls += roundData[i].correct ? ' correct' : ' wrong';
            if (i === roundData.length) cls += ' current';
            $dots.append($('<span>').addClass(cls));
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
            else { clearInterval(interval); $countdownOverlay.addClass('hidden'); startNewRound(); }
        }, 1000);
    }

    function startNewRound() {
        var diff = getDifficulty(level);
        var gridSize = diff.grid;

        // Remove old word tiles but keep UI area
        $grid.find('.wg-word-tile').remove();
        $grid.removeClass('grid-3 grid-4 grid-5').addClass('grid-' + gridSize);

        var totalCells = gridSize * gridSize;
        gridWords = getWords(diff.words);
        targetWord = gridWords[Math.floor(Math.random() * gridWords.length)];
        isPresent = true;

        var displayWords = gridWords.slice();
        while (displayWords.length < totalCells) displayWords.push('');
        shuffle(displayWords);

        // Insert word tiles before the UI area
        var $uiArea = $('#wg-ui-area');
        displayWords.forEach(function (w) {
            var $tile = $('<div>').addClass('wg-word-tile').text(w);
            $uiArea.before($tile);
        });

        responded = false;
        $('#wg-target-word').text('?');
        $('#wg-feedback').text('').removeClass('correct wrong');
        $('#wg-btn-yes, #wg-btn-no').prop('disabled', false);
        $('#wg-ui-area, #wg-btn-row, #wg-feedback').show();

        updateDisplay();
        updateProgressDots();
        setState(STATES.SHOWING);
    }

    function showGrid() {
        setStatus('Memorize the words...', 'watching');
        $grid.find('.wg-word-tile').each(function () {
            if ($(this).text() !== '') $(this).addClass('flash');
        });
        $('#wg-ui-area, #wg-btn-row, #wg-feedback').hide();

        var diff = getDifficulty(level);
        showTimeoutId = setTimeout(function () {
            $grid.find('.wg-word-tile').removeClass('flash').text('?');
            $('#wg-ui-area, #wg-btn-row, #wg-feedback').show();
            $('#wg-target-word').text(targetWord);
            setStatus('Was it in the grid?', 'your-turn');
        }, diff.flashMs);
    }

    function handleResponse(isYes) {
        if (state !== STATES.INPUT || responded) return;
        responded = true;
        $('#wg-btn-yes, #wg-btn-no').prop('disabled', true);

        var correct = (isYes === isPresent);
        var $fb = $('#wg-feedback');
        if (correct) {
            correctCount++;
            $fb.text('Correct!').addClass('correct').removeClass('wrong');
            if (window.CerebroSound) CerebroSound.correct();
        } else {
            wrongCount++;
            $fb.text('Wrong!').addClass('wrong').removeClass('correct');
            if (window.CerebroSound) CerebroSound.wrong();
            revealGrid();
        }

        var points = Math.max(0, BASE_POINTS - (wrongCount * 20) + (correctCount * 10));
        if (correct) score += points;

        roundData.push({ correct: correct, points: correct ? points : 0 });
        updateDisplay();
        updateProgressDots();

        nextRoundTimeoutId = setTimeout(function () {
            round++;
            if (round > TOTAL_ROUNDS || wrongCount >= 5) { setState(STATES.GAME_OVER); }
            else {
                if (round % 3 === 0 && level < 10) level++;
                startNewRound();
            }
        }, ROUND_DELAY);
    }

    function revealGrid() {
        var diff = getDifficulty(level);
        var totalCells = diff.grid * diff.grid;
        var displayWords = gridWords.slice();
        while (displayWords.length < totalCells) displayWords.push('');
        shuffle(displayWords);

        $grid.find('.wg-word-tile').remove();
        var $uiArea = $('#wg-ui-area');
        displayWords.forEach(function (w) {
            var cls = 'wg-word-tile';
            if (w !== '') cls += ' found';
            $uiArea.before($('<div>').addClass(cls).text(w || ''));
        });
    }

    function endGame() {
        gameTimer.stop();
        setStatus('Session complete', 'wrong');
        var acc = TOTAL_ROUNDS > 0 ? Math.round(correctCount / TOTAL_ROUNDS * 100) : 0;
        var title = acc >= 90 ? 'Excellent Recall' : acc >= 70 ? 'Strong Memory' : acc >= 50 ? 'Good Effort' : 'Keep Practicing';

        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + TOTAL_ROUNDS + ' correct');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(title);
        $('#result-badge').addClass('hidden');

        if (window.CerebroSound) CerebroSound.complete();
        if (window.CerebroApp && CerebroApp.animateScore) CerebroApp.animateScore(score);
        else $('#result-score').text(score);
        if (window.CerebroApp && CerebroApp.setTierBadge) CerebroApp.setTierBadge(score);
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) {
            CerebroApp.updatePerformanceMeters({ accuracy: acc, reaction: 0, streak: correctCount });
        }
        if (score > 2000 && window.CerebroApp && CerebroApp.spawnConfetti) CerebroApp.spawnConfetti();
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            var payload = {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: { rounds: roundData.map(function (r) { return { sequence: [], input: [r.correct ? 1 : 0], time_ms: 0 }; }) },
                accuracy: acc
            };
            CerebroAPI.post('/game/end', payload).fail(function () { CerebroAPI.queueForRetry('POST', '/game/end', payload); });
        }
    }

    function updateDisplay() {
        $displayLevel.text('Lv.' + level);
        $displayRound.text('R' + round + '/' + TOTAL_ROUNDS);
        $displayScore.text(score);
    }

    function setStatus(text, cls) {
        var $s = $('#game-status');
        $s.removeClass('watching your-turn correct wrong');
        if (cls) $s.addClass(cls);
        $statusText.text(text);
    }

    function bindEvents() {
        $(document).off('.wordgrid');
        $(document).on('click.wordgrid', '#wg-btn-yes', function () { handleResponse(true); });
        $(document).on('click.wordgrid', '#wg-btn-no', function () { handleResponse(false); });
        $(document).on('keydown.wordgrid', function (e) {
            if (state !== STATES.INPUT || responded) return;
            if (e.code === 'ArrowUp' || e.code === 'KeyY') { e.preventDefault(); handleResponse(true); }
            if (e.code === 'ArrowDown' || e.code === 'KeyN') { e.preventDefault(); handleResponse(false); }
        });
        $(document).on('visibilitychange.wordgrid', function () {
            if (document.hidden && state === STATES.SHOWING) { clearTimeout(showTimeoutId); state = STATES.INIT; }
        });
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        buildUI();
        CerebroAPI.post('/game/start', { game_slug: 'word-grid' })
            .done(function (r) { sessionToken = r.token; }).fail(function () {});
        updateDisplay();
        updateProgressDots();
        setState(STATES.COUNTDOWN);
    }

    function cleanup() {
        clearTimeout(showTimeoutId); clearTimeout(nextRoundTimeoutId);
        $(document).off('.wordgrid');
        $grid.empty().removeClass('wg-grid grid-3 grid-4 grid-5');
        state = STATES.INIT;
    }

    function getState() { return { state: state, level: level, round: round, score: score }; }

    return { init: init, startGame: startGame, cleanup: cleanup, getState: getState, STATES: STATES };

})(jQuery);
