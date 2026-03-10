/**
 * Cerebro — Application Bootstrap
 * 
 * SPA view routing, navigation, game registry, and global state management.
 */

'use strict';

var CerebroApp = (function ($) {

    // ── Game Registry ────────────────────────────────────
    var GAMES = {
        'pattern-recall': { module: function () { return PatternRecall; }, name: 'Pattern Recall', icon: '🔮', category: 'memory' },
        'digit-juggler': { module: function () { return DigitJuggler; }, name: 'Digit Juggler', icon: '🔢', category: 'memory' },
        'signal-hunter': { module: function () { return SignalHunter; }, name: 'Signal Hunter', icon: '🎯', category: 'attention' },
        'rule-shifter': { module: function () { return RuleShifter; }, name: 'Rule Shifter', icon: '🔄', category: 'logic' },
        'mirror-maze': { module: function () { return MirrorMaze; }, name: 'Mirror Maze', icon: '🪞', category: 'logic' },
        'impulse-guard': { module: function () { return ImpulseGuard; }, name: 'Impulse Guard', icon: '🛡️', category: 'attention' },
        'rapid-sort': { module: function () { return RapidSort; }, name: 'Rapid Sort', icon: '⚡', category: 'speed' }
    };

    // ── State ────────────────────────────────────────────
    var currentView = 'dashboard';
    var currentGame = null;
    var activeGameModule = null;

    // ── View Management ──────────────────────────────────

    function showView(viewId) {
        $('.view').removeClass('active');
        $('#view-' + viewId).addClass('active');
        $('.nav-btn').removeClass('active');
        $('.nav-btn[data-view="' + viewId + '"]').addClass('active');
        onViewEnter(viewId);
        currentView = viewId;
    }

    function onViewEnter(viewId) {
        switch (viewId) {
            case 'leaderboard':
                loadLeaderboard();
                break;
            case 'game':
                if (activeGameModule) {
                    activeGameModule.init();
                }
                break;
        }
    }

    // ── Navigation Binding ───────────────────────────────

    function bindNavigation() {
        $(document).on('click', '.nav-btn', function () {
            var viewId = $(this).data('view');
            if (viewId) {
                if (currentView === 'game' && viewId !== 'game') {
                    cleanupCurrentGame();
                }
                showView(viewId);
            }
        });

        // Game card play button
        $(document).on('click', '.btn-play', function () {
            var gameSlug = $(this).data('game');
            launchGame(gameSlug);
        });

        // Category cards → navigate to games view
        $(document).on('click', '.category-card', function () {
            showView('games');
        });

        // Back button
        $(document).on('click', '#btn-back', function () {
            cleanupCurrentGame();
            showView('games');
        });

        // Game-over modal buttons
        $(document).on('click', '#btn-play-again', function () {
            $('#modal-gameover').addClass('hidden');
            if (activeGameModule) {
                activeGameModule.startGame();
            }
        });

        $(document).on('click', '#btn-go-home', function () {
            $('#modal-gameover').addClass('hidden');
            cleanupCurrentGame();
            showView('games');
        });
    }

    // ── Game Launch ──────────────────────────────────────

    function launchGame(gameSlug) {
        if (!GAMES[gameSlug]) {
            console.warn('[Cerebro] Unknown game:', gameSlug);
            return;
        }

        currentGame = gameSlug;
        var reg = GAMES[gameSlug];
        activeGameModule = reg.module();

        // Update game view header
        $('#game-title').text(reg.name);

        // Update start screen for the game
        updateStartScreen(gameSlug, reg);

        showView('game');
    }

    function updateStartScreen(slug, reg) {
        var $start = $('#game-start-screen');
        var descriptions = {
            'pattern-recall': { desc: 'Memorize the flashing tiles and replay them in order', rules: ['Watch the tiles light up', 'Tap them back in the same order', 'Each round adds one more tile', 'Faster responses earn bonus points'] },
            'digit-juggler': { desc: 'Remember the digit shown N positions ago', rules: ['Digits appear one at a time', 'Press Match if current digit = N digits back', 'Press No Match otherwise', 'Accuracy earns more than guessing'] },
            'signal-hunter': { desc: 'Find all target symbols hidden among distractors', rules: ['A target symbol is shown before each round', 'Tap every instance in the field', 'Avoid tapping distractors', 'Speed + accuracy = higher score'] },
            'rule-shifter': { desc: 'Sort cards into bins — but the sorting rule changes silently', rules: ['Cards have color, shape, and count', 'Sort by the unknown active rule', 'The rule changes after correct streaks', 'Adapt quickly after each shift'] },
            'mirror-maze': { desc: 'Predict where a ball exits after bouncing off mirrors', rules: ['Mentally trace the ball path through mirrors', 'Select the correct exit edge cell', 'Click Confirm to submit your answer', 'More mirrors = harder puzzles'] },
            'impulse-guard': { desc: 'Tap every shape EXCEPT the forbidden one', rules: ['Shapes flash rapidly one at a time', 'Tap on Go shapes as fast as possible', 'Do NOT tap the forbidden shape', 'The forbidden shape may change mid-game'] },
            'rapid-sort': { desc: 'Classify words into two categories as fast as possible', rules: ['A word appears — choose left or right', 'Use arrow keys or click buttons', 'Categories change between rounds', 'Speed and accuracy both matter'] }
        };

        var info = descriptions[slug] || { desc: '', rules: [] };
        $start.find('.start-icon').text(reg.icon);
        $start.find('h2').text(reg.name);
        $start.find('p').first().text(info.desc);
        var $ul = $start.find('.rules-list');
        $ul.empty();
        info.rules.forEach(function (rule) {
            $ul.append('<li>' + rule + '</li>');
        });

        $start.removeClass('hidden');

        // Wire the start button for this game
        $('#btn-start-game').off('click').on('click', function () {
            $start.addClass('hidden');
            if (activeGameModule && activeGameModule.startGame) {
                activeGameModule.startGame();
            }
        });
    }

    function cleanupCurrentGame() {
        if (activeGameModule && activeGameModule.cleanup) {
            activeGameModule.cleanup();
        }
        activeGameModule = null;
        currentGame = null;
        // Reset lives display
        $('#display-lives').html('<span class="heart">♥</span><span class="heart">♥</span><span class="heart">♥</span>');
    }

    // ── Leaderboard ──────────────────────────────────────

    function loadLeaderboard() {
        var gameSlug = $('#leaderboard-game-select').val() || 'pattern-recall';

        CerebroAPI.get('/scores/leaderboard', { game: gameSlug, limit: 20 })
            .done(function (response) {
                renderLeaderboard(response.scores);
            })
            .fail(function () {
                renderLeaderboard([]);
            });
    }

    function renderLeaderboard(scores) {
        var $body = $('#leaderboard-body');

        if (!scores || scores.length === 0) {
            $body.html('<tr><td colspan="5" class="empty-state">No scores yet. Be the first!</td></tr>');
            return;
        }

        var html = '';
        scores.forEach(function (entry) {
            var date = new Date(entry.created_at);
            var dateStr = date.toLocaleDateString();
            var rankIcon = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : '#' + entry.rank;

            html += '<tr>';
            html += '<td>' + rankIcon + '</td>';
            html += '<td>' + escapeHtml(entry.username) + '</td>';
            html += '<td><strong>' + entry.score.toLocaleString() + '</strong></td>';
            html += '<td>' + entry.level_reached + '</td>';
            html += '<td>' + dateStr + '</td>';
            html += '</tr>';
        });

        $body.html(html);
    }

    function bindLeaderboard() {
        $('#leaderboard-game-select').on('change', function () {
            loadLeaderboard();
        });
    }

    // ── Utilities ────────────────────────────────────────

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ── Initialization ───────────────────────────────────

    function init() {
        bindNavigation();
        bindLeaderboard();
        showView('dashboard');

        if (CerebroAPI.getQueueCount() > 0) {
            CerebroAPI.processQueue();
        }

        console.log('[Cerebro] App initialized — ' + Object.keys(GAMES).length + ' games registered');
    }

    // ── Boot ─────────────────────────────────────────────
    $(document).ready(function () {
        init();
    });

    // ── Public API ───────────────────────────────────────
    return {
        showView: showView,
        launchGame: launchGame,
        init: init,
        GAMES: GAMES
    };

})(jQuery);
