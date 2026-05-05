/**
 * Cerebro — Application Bootstrap
 *
 * SPA view routing, navigation, game registry, and global state management.
 */

'use strict';

var CerebroApp = (function ($) {

    var GAMES = {
        'pattern-recall': { module: function () { return PatternRecall; }, name: 'Pattern Recall', icon: '🔮', category: 'memory' },
        'digit-juggler': { module: function () { return DigitJuggler; }, name: 'Digit Juggler', icon: '🔢', category: 'memory' },
        'signal-hunter': { module: function () { return SignalHunter; }, name: 'Signal Hunter', icon: '🎯', category: 'attention' },
        'rule-shifter': { module: function () { return RuleShifter; }, name: 'Rule Shifter', icon: '🔄', category: 'logic' },
        'mirror-maze': { module: function () { return MirrorMaze; }, name: 'Mirror Maze', icon: '🪞', category: 'logic' },
        'impulse-guard': { module: function () { return ImpulseGuard; }, name: 'Impulse Guard', icon: '🛡️', category: 'attention' },
        'rapid-sort': { module: function () { return RapidSort; }, name: 'Rapid Sort', icon: '⚡', category: 'speed' }
    };

    var currentView = 'dashboard';
    var currentGame = null;
    var activeGameModule = null;
    var activeCategoryFilter = 'all';
    var pendingGameLaunch = null;

    function showView(viewId) {
        $('.view').removeClass('active');
        $('#view-' + viewId).addClass('active');
        $('.nav-btn').removeClass('active');
        $('.nav-btn[data-view="' + viewId + '"]').addClass('active');
        onViewEnter(viewId);
        currentView = viewId;
    }

    function onViewEnter(viewId) {
        if (viewId === 'leaderboard') {
            loadLeaderboard();
        }

        if (viewId === 'auth' && window.CerebroHero && CerebroHero.refresh) {
            CerebroHero.refresh();
        }

        if (viewId === 'game' && activeGameModule) {
            activeGameModule.init();
        }
    }

    function bindNavigation() {
        $(document).on('click', '.nav-btn', function () {
            var viewId = $(this).data('view');
            if (!viewId) {
                return;
            }

            if (currentView === 'game' && viewId !== 'game') {
                cleanupCurrentGame();
            }

            showView(viewId);
        });

        $(document).on('click', '.btn-play', function () {
            launchGame($(this).data('game'));
        });

        $(document).on('click', '.category-card', function () {
            var category = $(this).data('category') || 'all';
            setCategoryFilter(category);
            showView('games');
        });

        $(document).on('click', '.filter-chip', function () {
            setCategoryFilter($(this).data('category-filter') || 'all');
        });

        $(document).on('click', '[data-view-target]', function () {
            var targetView = $(this).data('view-target');
            if (targetView) {
                if (currentView === 'game' && targetView !== 'game') {
                    cleanupCurrentGame();
                }
                showView(targetView);
            }
        });

        $(document).on('click', '#btn-back', function () {
            cleanupCurrentGame();
            showView('games');
        });

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

        $(document).on('click', '.leaderboard-cta', function () {
            if (window.CerebroAuth && !CerebroAuth.isAuthenticated()) {
                CerebroAuth.openAuth('Sign in with Google to appear on the leaderboard.');
            }
        });

        $(document).on('cerebro:auth-success', function () {
            if (pendingGameLaunch) {
                var gameSlug = pendingGameLaunch;
                pendingGameLaunch = null;
                launchGame(gameSlug, { skipAuthCheck: true });
            }
        });
    }

    function launchGame(gameSlug, options) {
        options = options || {};

        if (!GAMES[gameSlug]) {
            console.warn('[Cerebro] Unknown game:', gameSlug);
            return;
        }

        if (!options.skipAuthCheck && window.CerebroAuth && !CerebroAuth.isAuthenticated()) {
            pendingGameLaunch = gameSlug;
            CerebroAuth.openAuth('Sign in with Google to start ' + GAMES[gameSlug].name + '.');
            return;
        }

        currentGame = gameSlug;
        activeGameModule = GAMES[gameSlug].module();

        $('#game-title').text(GAMES[gameSlug].name);
        updateStartScreen(gameSlug, GAMES[gameSlug]);
        showView('game');
    }

    function updateStartScreen(slug, reg) {
        var $start = $('#game-start-screen');
        var descriptions = {
            'pattern-recall': { desc: 'A memory exercise that helps you retain and replay visual sequences.', rules: ['Watch the pattern carefully', 'Replay the full sequence in order', 'Each round adds one more step', 'Stay accurate and keep a steady pace'] },
            'digit-juggler': { desc: 'An active-memory exercise built around tracking what appeared a few steps earlier.', rules: ['Digits appear one at a time', 'Compare the current digit with the one N steps back', 'Respond once you are confident', 'Steady accuracy matters more than rushing'] },
            'signal-hunter': { desc: 'A focus exercise for spotting targets while ignoring visual distractions.', rules: ['Find the target signal for the round', 'Select every valid target you see', 'Ignore close-looking distractors', 'Careful attention improves your score'] },
            'rule-shifter': { desc: 'A logic exercise that helps you adapt when hidden rules change.', rules: ['Sort using the active hidden rule', 'Use feedback to infer the pattern', 'Expect the rule to shift during the session', 'Adjust quickly as new information appears'] },
            'mirror-maze': { desc: 'A spatial-reasoning exercise for mentally tracing paths and predicting outcomes.', rules: ['Trace the path through each mirror', 'Predict the correct exit', 'Choose once your answer feels clear', 'Later rounds add more complexity'] },
            'impulse-guard': { desc: 'A response-control exercise focused on attention and restraint.', rules: ['React quickly to valid shapes', 'Pause when the forbidden shape appears', 'Watch for shifting forbidden cues', 'Control and timing both matter'] },
            'rapid-sort': { desc: 'A speed exercise for sorting signals quickly without losing accuracy.', rules: ['Sort each signal left or right', 'Follow the current category rule', 'Move quickly while staying accurate', 'Consistency builds stronger results'] }
        };

        var info = descriptions[slug] || { desc: '', rules: [] };
        $start.find('.start-icon').text(reg.icon);
        $start.find('h2').text(reg.name);
        $start.find('p').first().text(info.desc);

        var $rules = $start.find('.rules-list');
        $rules.empty();
        info.rules.forEach(function (rule) {
            $rules.append('<li>' + rule + '</li>');
        });

        $start.removeClass('hidden');

        $('#btn-start-game').off('click').on('click', function () {
            $start.addClass('hidden');
            if (activeGameModule && activeGameModule.startGame) {
                activeGameModule.startGame();
            }
        });
    }

    function setCategoryFilter(category) {
        activeCategoryFilter = category || 'all';

        $('.filter-chip').removeClass('active');
        $('.filter-chip[data-category-filter="' + activeCategoryFilter + '"]').addClass('active');
        $('.category-card').removeClass('active');
        $('.category-card[data-category="' + activeCategoryFilter + '"]').addClass('active');

        $('.gallery-card').each(function () {
            var matches = activeCategoryFilter === 'all' || $(this).data('category') === activeCategoryFilter;
            $(this).toggleClass('is-hidden', !matches);
        });
    }

    function cleanupCurrentGame() {
        if (activeGameModule && activeGameModule.cleanup) {
            activeGameModule.cleanup();
        }

        activeGameModule = null;
        currentGame = null;
        $('#display-lives').html('<span class="heart">♥</span><span class="heart">♥</span><span class="heart">♥</span>');
    }

    function loadLeaderboard() {
        var gameSlug = $('#leaderboard-game-select').val() || 'pattern-recall';

        CerebroAPI.get('/scores/leaderboard', { game: gameSlug, limit: 20 })
            .done(function (response) {
                renderLeaderboard(response.scores || []);
            })
            .fail(function () {
                renderLeaderboard([]);
            });
    }

    function renderLeaderboard(scores) {
        var $body = $('#leaderboard-body');
        if ($body.length === 0) {
            return;
        }

        if (!scores.length) {
            $body.html('<tr><td colspan="5" class="empty-state">No scores yet. Be the first!</td></tr>');
            return;
        }

        var html = '';
        scores.forEach(function (entry) {
            var dateStr = new Date(entry.created_at).toLocaleDateString();
            var rankLabel = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : '#' + entry.rank;

            html += '<tr>';
            html += '<td>' + rankLabel + '</td>';
            html += '<td>' + escapeHtml(entry.username) + '</td>';
            html += '<td><strong>' + Number(entry.score || 0).toLocaleString() + '</strong></td>';
            html += '<td>' + escapeHtml(String(entry.level_reached)) + '</td>';
            html += '<td>' + escapeHtml(dateStr) + '</td>';
            html += '</tr>';
        });

        $body.html(html);
    }

    function bindLeaderboard() {
        $('#leaderboard-game-select').on('change', function () {
            loadLeaderboard();
        });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function init() {
        bindNavigation();
        bindLeaderboard();
        setCategoryFilter('all');
        showView('dashboard');

        if (CerebroAPI.getQueueCount() > 0) {
            CerebroAPI.processQueue();
        }

        console.log('[Cerebro] App initialized — ' + Object.keys(GAMES).length + ' games registered');
    }

    $(document).ready(function () {
        init();
    });

    return {
        showView: showView,
        launchGame: launchGame,
        init: init,
        GAMES: GAMES
    };

})(jQuery);
