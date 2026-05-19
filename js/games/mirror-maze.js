/**
 * Cerebro — Mirror Maze Game Engine
 *
 * Spatial reasoning: predict ball path through mirrored grid.
 */

'use strict';

var MirrorMaze = (function ($) {

    var STATES = {
        INIT: 'INIT', COUNTDOWN: 'COUNTDOWN', PUZZLE_SHOW: 'PUZZLE_SHOW',
        PLAYING: 'PLAYING', REVEAL: 'REVEAL', RESULTS: 'RESULTS'
    };

    var DIFFICULTY = [
        { grid: 4, mirrors: 2, types: ['/'], time: 12000, puzzles: 8 },
        { grid: 5, mirrors: 3, types: ['/'], time: 10000, puzzles: 8 },
        { grid: 5, mirrors: 4, types: ['/', '\\'], time: 9000, puzzles: 10 },
        { grid: 6, mirrors: 5, types: ['/', '\\'], time: 8000, puzzles: 10 },
        { grid: 7, mirrors: 6, types: ['/', '\\'], time: 7000, puzzles: 10 },
    ];

    var DIRS = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

    var state = STATES.INIT;
    var level = 1, score = 0;
    var puzzleIndex = 0;
    var gridSize, mirrors, entryPos, entryDir, correctExit;
    var selectedExit = null;
    var keyboardExitIdx = 0;
    var puzzleData = [];
    var puzzleTimerInterval = null;
    var gameTimer = CerebroTimer.create();
    var puzzleTimer = CerebroTimer.create();
    var sessionToken = null;

    function getDifficulty(lvl) {
        return lvl <= DIFFICULTY.length ? DIFFICULTY[lvl - 1] : DIFFICULTY[DIFFICULTY.length - 1];
    }

    // ══════════════════════════════════════════════════════
    // PUZZLE GENERATION
    // ══════════════════════════════════════════════════════

    function generatePuzzle() {
        var diff = getDifficulty(level);
        gridSize = diff.grid;
        mirrors = [];

        // Place mirrors randomly in the interior
        var placed = 0;
        while (placed < diff.mirrors) {
            var mx = 1 + Math.floor(Math.random() * (gridSize - 2));
            var my = 1 + Math.floor(Math.random() * (gridSize - 2));
            var exists = mirrors.some(function (m) { return m.x === mx && m.y === my; });
            if (!exists) {
                var type = diff.types[Math.floor(Math.random() * diff.types.length)];
                mirrors.push({ x: mx, y: my, type: type });
                placed++;
            }
        }

        // Pick random entry edge
        var edges = getEdgePositions();
        var entryEdge = edges[Math.floor(Math.random() * edges.length)];
        entryPos = { x: entryEdge.x, y: entryEdge.y };
        entryDir = entryEdge.dir;

        // Trace path to find exit
        correctExit = tracePath(entryPos, entryDir);
        selectedExit = null;

        // Validate: ensure path exits (not stuck)
        if (!correctExit) {
            // Regenerate
            generatePuzzle();
        }
    }

    function getEdgePositions() {
        var edges = [];
        for (var i = 1; i < gridSize - 1; i++) {
            edges.push({ x: 0, y: i, dir: 'RIGHT' });
            edges.push({ x: gridSize - 1, y: i, dir: 'LEFT' });
            edges.push({ x: i, y: 0, dir: 'DOWN' });
            edges.push({ x: i, y: gridSize - 1, dir: 'UP' });
        }
        return edges;
    }

    function tracePath(start, dir) {
        var x = start.x + DIRS[dir][0];
        var y = start.y + DIRS[dir][1];
        var path = [{ x: start.x, y: start.y }];
        var maxSteps = gridSize * gridSize * 2;
        var steps = 0;

        while (steps < maxSteps) {
            // Out of bounds = exit found
            if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
                return { x: x - DIRS[dir][0], y: y - DIRS[dir][1], path: path };
            }

            path.push({ x: x, y: y });

            // Check for mirror
            var mirror = mirrors.find(function (m) { return m.x === x && m.y === y; });
            if (mirror) {
                dir = reflectDirection(dir, mirror.type);
            }

            x += DIRS[dir][0];
            y += DIRS[dir][1];
            steps++;
        }

        return null; // Stuck
    }

    function reflectDirection(dir, mirrorType) {
        if (mirrorType === '/') {
            switch (dir) {
                case 'RIGHT': return 'UP';
                case 'LEFT': return 'DOWN';
                case 'UP': return 'RIGHT';
                case 'DOWN': return 'LEFT';
            }
        } else { // '\'
            switch (dir) {
                case 'RIGHT': return 'DOWN';
                case 'LEFT': return 'UP';
                case 'UP': return 'LEFT';
                case 'DOWN': return 'RIGHT';
            }
        }
        return dir;
    }

    // ══════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════

    function buildUI() {
        var $c = $('#mm-container');
        if ($c.length === 0) { $c = $('<div id="mm-container"></div>').appendTo('#game-area'); }
        $('#game-board').hide(); $('#game-start-screen').addClass('hidden');

        $c.html(
            '<div class="mm-puzzle-info">' +
            '  <span class="mm-puzzle-counter" id="mm-counter">Puzzle 1</span>' +
            '  <span class="mm-puzzle-timer" id="mm-timer">—</span>' +
            '</div>' +
            '<div id="mm-grid-wrap"></div>' +
            '<div class="mm-confirm-row"><button class="btn btn-primary" id="mm-confirm">Confirm Exit</button></div>'
        ).show();
    }

    function renderGrid() {
        var totalSize = gridSize + 2; // +2 for edge border
        var $wrap = $('#mm-grid-wrap');
        $wrap.html('<div class="mm-grid grid-' + gridSize + '" id="mm-grid"></div>');
        var $grid = $('#mm-grid');
        $grid.css({
            'grid-template-columns': 'repeat(' + totalSize + ', 1fr)',
            'grid-template-rows': 'repeat(' + totalSize + ', 1fr)'
        }).removeClass('grid-4 grid-5 grid-6 grid-7 grid-8').addClass('grid-' + gridSize);

        for (var y = 0; y < totalSize; y++) {
            for (var x = 0; x < totalSize; x++) {
                var isEdge = (x === 0 || x === totalSize - 1 || y === 0 || y === totalSize - 1);
                var isCorner = (x === 0 || x === totalSize - 1) && (y === 0 || y === totalSize - 1);
                var innerX = x - 1, innerY = y - 1;

                var classes = 'mm-cell';
                var content = '';
                var dataAttr = '';

                if (isCorner) {
                    classes += ' corner';
                } else if (isEdge) {
                    classes += ' edge';
                    // Map edge cell to inner grid coordinate
                    var edgeCoord = getEdgeCellInnerCoord(x, y, totalSize);
                    if (edgeCoord) {
                        dataAttr = 'data-ex="' + edgeCoord.x + '" data-ey="' + edgeCoord.y + '"';
                        // Is this the entry?
                        if (edgeCoord.x === entryPos.x && edgeCoord.y === entryPos.y) {
                            classes += ' entry';
                            content = '<span class="mm-entry-arrow">' + getArrowForDir(entryDir) + '</span>';
                        } else {
                            classes += ' selectable';
                        }
                    }
                } else {
                    // Inner cell — check for mirror
                    var mirror = mirrors.find(function (m) { return m.x === innerX && m.y === innerY; });
                    if (mirror) {
                        content = '<div class="mm-mirror ' + (mirror.type === '/' ? 'forward-slash' : 'back-slash') + '"></div>';
                    }
                }

                $grid.append('<div class="' + classes + '" ' + dataAttr + '>' + content + '</div>');
            }
        }
    }

    function getEdgeCellInnerCoord(x, y, totalSize) {
        // Map outer edge cells to inner grid coordinates
        if (x === 0 && y > 0 && y < totalSize - 1) return { x: 0, y: y - 1 };
        if (x === totalSize - 1 && y > 0 && y < totalSize - 1) return { x: gridSize - 1, y: y - 1 };
        if (y === 0 && x > 0 && x < totalSize - 1) return { x: x - 1, y: 0 };
        if (y === totalSize - 1 && x > 0 && x < totalSize - 1) return { x: x - 1, y: gridSize - 1 };
        return null;
    }

    function getArrowForDir(dir) {
        return { UP: '↓', DOWN: '↑', LEFT: '→', RIGHT: '←' }[dir] || '→';
    }

    // ══════════════════════════════════════════════════════
    // GAMEPLAY
    // ══════════════════════════════════════════════════════

    function showPuzzle() {
        var diff = getDifficulty(level);
        generatePuzzle();
        renderGrid();
        $('#mm-counter').text('Puzzle ' + (puzzleIndex + 1) + ' / ' + diff.puzzles);
        state = STATES.PLAYING;
        selectedExit = null;
        keyboardExitIdx = 0;
        puzzleTimer.reset().start();
        startPuzzleTimer(diff.time);
        setStatus('Where does the ball exit?', 'your-turn');
    }

    function startPuzzleTimer(ms) {
        var remaining = ms;
        var $timer = $('#mm-timer');
        $timer.text((remaining / 1000).toFixed(1) + 's').removeClass('urgent');
        clearInterval(puzzleTimerInterval);
        puzzleTimerInterval = setInterval(function () {
            remaining -= 100;
            $timer.text((Math.max(0, remaining) / 1000).toFixed(1) + 's');
            if (remaining <= 3000) $timer.addClass('urgent');
            if (remaining <= 0) { clearInterval(puzzleTimerInterval); confirmAnswer(); }
        }, 100);
    }

    function selectExit(ex, ey) {
        if (state !== STATES.PLAYING) return;
        $('.mm-cell.edge').removeClass('selected');
        var $cell = $('.mm-cell.edge[data-ex="' + ex + '"][data-ey="' + ey + '"]');
        $cell.addClass('selected');
        selectedExit = { x: parseInt(ex), y: parseInt(ey) };
    }

    function confirmAnswer() {
        if (state !== STATES.PLAYING) return;
        clearInterval(puzzleTimerInterval);
        puzzleTimer.stop();
        state = STATES.REVEAL;

        var correct = selectedExit &&
            selectedExit.x === correctExit.x && selectedExit.y === correctExit.y;

        // Highlight correct exit
        var $correctCell = $('.mm-cell.edge[data-ex="' + correctExit.x + '"][data-ey="' + correctExit.y + '"]');
        $correctCell.addClass('correct-exit');

        if (selectedExit && !correct) {
            var $wrongCell = $('.mm-cell.edge[data-ex="' + selectedExit.x + '"][data-ey="' + selectedExit.y + '"]');
            $wrongCell.addClass('wrong-exit');
        }

        if (correct) {
            var diff = getDifficulty(level);
            var diffMult = 1.0 + (mirrors.length * 0.2) + (gridSize * 0.1);
            var timeBonus = Math.max(0.3, 1.0 - (puzzleTimer.getElapsedMs() / diff.time));
            var puzzleScore = Math.round(100 * diffMult * timeBonus);
            score += puzzleScore;
            if (window.CerebroSound) CerebroSound.correct();
            setStatus('Correct! +' + puzzleScore, 'correct');
        } else {
            if (window.CerebroSound) CerebroSound.wrong();
            setStatus('Wrong! The correct exit is highlighted.', 'wrong');
        }

        puzzleData.push({
            mirrors: mirrors.length, grid: gridSize + 'x' + gridSize,
            correct: correct, time_ms: puzzleTimer.getElapsedMs()
        });

        updateDisplay();

        setTimeout(function () {
            puzzleIndex++;
            var diff = getDifficulty(level);
            if (puzzleIndex >= diff.puzzles) {
                endGame();
            } else {
                if (puzzleIndex % 3 === 0 && level < DIFFICULTY.length) level++;
                showPuzzle();
            }
        }, 2000);
    }

    // ══════════════════════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════════════════════

    function startGame() {
        score = 0; level = 1; puzzleIndex = 0; puzzleData = []; sessionToken = null;
        gameTimer.reset().start();
        buildUI();

        CerebroAPI.post('/game/start', { game_slug: 'mirror-maze' })
            .done(function (r) { sessionToken = r.token; }).fail(function () { });
        updateDisplay();
        runCountdown(function () { showPuzzle(); });
    }

    function endGame() {
        state = STATES.RESULTS; gameTimer.stop();
        var correctCount = puzzleData.filter(function (p) { return p.correct; }).length;
        var acc = puzzleData.length > 0 ? Math.round(correctCount / puzzleData.length * 100) : 0;
        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + puzzleData.length + ' correct');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(acc > 70 ? 'Great Spatial Sense' : 'Keep Practicing');
        $('#result-badge').addClass('hidden');
        if (window.CerebroSound) CerebroSound.complete();
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
                accuracy: acc,
                reaction: 0,
                streak: correctCount
            });
        }
        if (score > 2000 && window.CerebroApp && CerebroApp.spawnConfetti) {
            CerebroApp.spawnConfetti();
        }
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            var payload = {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: {
                    rounds: puzzleData.map(function (p) {
                        return { sequence: [p.grid], input: [p.correct ? 1 : 0], time_ms: p.time_ms };
                    })
                }
            };
            CerebroAPI.post('/game/end', payload).fail(function () {
                CerebroAPI.queueForRetry('POST', '/game/end', payload);
            });
        }
    }

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
        $('#display-level').text('Lv.' + level);
        $('#display-round').text('P' + (puzzleIndex + 1));
        $('#display-score').text(score);
    }

    function bindEvents() {
        $(document).off('.mirrormaze');
        $(document).on('click.mirrormaze', '.mm-cell.edge.selectable', function () {
            selectExit($(this).attr('data-ex'), $(this).attr('data-ey'));
        });
        $(document).on('click.mirrormaze', '#mm-confirm', function () { confirmAnswer(); });
        $(document).on('keydown.mirrormaze', function (e) {
            if (state !== STATES.PLAYING) return;
            var $exits = $('.mm-cell.edge.selectable');
            if ($exits.length === 0) return;
            if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
                e.preventDefault();
                keyboardExitIdx = (keyboardExitIdx - 1 + $exits.length) % $exits.length;
                var $prev = $exits.eq(keyboardExitIdx);
                selectExit($prev.attr('data-ex'), $prev.attr('data-ey'));
            } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
                e.preventDefault();
                keyboardExitIdx = (keyboardExitIdx + 1) % $exits.length;
                var $next = $exits.eq(keyboardExitIdx);
                selectExit($next.attr('data-ex'), $next.attr('data-ey'));
            } else if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                confirmAnswer();
            }
        });
    }

    function init() { bindEvents(); }

    function cleanup() {
        clearInterval(puzzleTimerInterval);
        $(document).off('.mirrormaze');
        $('#mm-container').remove();
        state = STATES.INIT;
    }

    return {
        slug: 'mirror-maze', name: 'Mirror Maze', category: 'logic',
        init: init, startGame: startGame, cleanup: cleanup,
        getState: function () { return { state: state, score: score }; }, STATES: STATES
    };
})(jQuery);
