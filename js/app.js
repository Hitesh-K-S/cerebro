/**
 * Cerebro — Application Bootstrap
 *
 * SPA view routing, navigation, game registry, and global state management.
 */

'use strict';

var CerebroApp = (function ($) {

    var CATEGORY_META = {
        all: { label: 'All Drills', kicker: 'Catalog Overview', description: 'View every cognitive drill across all training domains.', icon: '◎' },
        memory: { label: 'Memory', kicker: 'Recall Systems', description: 'Strengthen retention, sequence tracking, and spatial recall under pressure.', icon: '◈' },
        attention: { label: 'Attention', kicker: 'Focus Control', description: 'Train selective focus, restraint, and target detection in noisy conditions.', icon: '◉' },
        logic: { label: 'Logic', kicker: 'Adaptive Reasoning', description: 'Sharpen deduction, rule adaptation, and spatial reasoning across layered puzzles.', icon: '△' },
        speed: { label: 'Speed', kicker: 'Processing Speed', description: 'Increase reaction tempo and classification speed while preserving accuracy.', icon: '✦' }
    };

    var GAMES = {
        'pattern-recall': {
            module: function () { return PatternRecall; },
            name: 'Pattern Recall',
            category: 'memory',
            difficulty: 'Easy',
            skill: 'Spatial Recall',
            duration: '3-4 min',
            description: 'Memorize visual tile sequences and replay them exactly under growing cognitive load.',
            mode: 'Sequence retention drill',
            image: 'assets/games/pattern-recall-card.png'
        },
        'digit-juggler': {
            module: function () { return DigitJuggler; },
            name: 'Digit Juggler',
            category: 'memory',
            difficulty: 'Medium',
            skill: 'Working Memory',
            duration: '4-5 min',
            description: 'Track what appeared several steps earlier and respond with disciplined working-memory recall.',
            mode: 'N-back memory challenge',
            image: 'assets/games/digit-juggler-card.png'
        },
        'signal-hunter': {
            module: function () { return SignalHunter; },
            name: 'Signal Hunter',
            category: 'attention',
            difficulty: 'Medium',
            skill: 'Selective Attention',
            duration: '3-4 min',
            description: 'Scan dense visual noise, isolate true targets, and reject close-looking distractors fast.',
            mode: 'Target isolation drill',
            image: 'assets/games/signal-hunter-card.png'
        },
        'rule-shifter': {
            module: function () { return RuleShifter; },
            name: 'Rule Shifter',
            category: 'logic',
            difficulty: 'Hard',
            skill: 'Adaptive Logic',
            duration: '4-6 min',
            description: 'Infer hidden sorting rules, then stay accurate when those rules change mid-session.',
            mode: 'Rule adaptation puzzle',
            image: 'assets/games/rule-shifter-card.png'
        },
        'mirror-maze': {
            module: function () { return MirrorMaze; },
            name: 'Mirror Maze',
            category: 'logic',
            difficulty: 'Medium',
            skill: 'Spatial Reasoning',
            duration: '4-5 min',
            description: 'Predict path outcomes through reflective layouts and mentally simulate changing geometry.',
            mode: 'Reflection path solver',
            image: 'assets/games/mirror-maze-card.png'
        },
        'impulse-guard': {
            module: function () { return ImpulseGuard; },
            name: 'Impulse Guard',
            category: 'attention',
            difficulty: 'Hard',
            skill: 'Response Control',
            duration: '3-5 min',
            description: 'React to valid prompts quickly while suppressing fast mistakes when forbidden cues appear.',
            mode: 'Inhibition control drill',
            image: 'assets/games/impulse-guard-card.png'
        },
        'rapid-sort': {
            module: function () { return RapidSort; },
            name: 'Rapid Sort',
            category: 'speed',
            difficulty: 'Hard',
            skill: 'Rapid Classification',
            duration: '2-3 min',
            description: 'Sort signals at high speed while maintaining control as the classification tempo climbs.',
            mode: 'High-tempo sort sprint',
            image: 'assets/games/rapid-sort-card.png'
        },
        'word-grid': {
            module: function () { return WordGrid; },
            name: 'Word Grid',
            category: 'memory',
            difficulty: 'Medium',
            skill: 'Semantic Recall',
            duration: '3-4 min',
            description: 'Memorize a grid of words and recall whether a target was present — trains semantic working memory.',
            mode: 'Word presence recall',
            image: 'assets/games/word-grid-card.png'
        },
        'flanker-task': {
            module: function () { return FlankerTask; },
            name: 'Flanker Task',
            category: 'attention',
            difficulty: 'Medium',
            skill: 'Selective Attention',
            duration: '3-4 min',
            description: 'Respond to the center arrow direction while ignoring flanking distractors — trains selective attention.',
            mode: 'Eriksen flanker paradigm',
            image: 'assets/games/flanker-task-card.svg'
        },
        'syllogisms': {
            module: function () { return Syllogisms; },
            name: 'Syllogisms',
            category: 'logic',
            difficulty: 'Hard',
            skill: 'Deductive Reasoning',
            duration: '4-6 min',
            description: 'Judge whether logical conclusions follow from given premises — trains deductive reasoning.',
            mode: 'Syllogistic logic drill',
            image: 'assets/games/syllogisms-card.svg'
        }
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

        if (viewId === 'stats') {
            loadStats();
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

        currentGame = gameSlug;
        activeGameModule = GAMES[gameSlug].module();

        var reg = GAMES[gameSlug];

        $('#game-title').text(reg.name);
        $('#game-category-label').text(CATEGORY_META[reg.category] ? CATEGORY_META[reg.category].label : reg.category);

        // Set ambient category class on game area
        $('#game-area').removeClass('category-memory category-attention category-logic category-speed')
            .addClass('category-' + reg.category);

        updateStartScreen(gameSlug, reg);
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
            'rapid-sort': { desc: 'A speed exercise for sorting signals quickly without losing accuracy.', rules: ['Sort each signal left or right', 'Follow the current category rule', 'Move quickly while staying accurate', 'Consistency builds stronger results'] },
            'word-grid': { desc: 'A semantic memory exercise that challenges your ability to remember words seen briefly in a grid.', rules: ['Watch the grid of words carefully', 'A target word will appear', 'Answer if the word was in the grid', 'Speed and accuracy both count toward your score'] },
            'flanker-task': { desc: 'A selective attention exercise where you respond to the center arrows direction while ignoring flanking distractors.', rules: ['Five arrows appear — focus on the center one', 'Press the key matching the center arrows direction', 'Ignore the flanking arrows on both sides', 'Speed and accuracy both count toward your score'] },
            'syllogisms': { desc: 'A deductive reasoning exercise where you evaluate whether conclusions follow logically from given premises.', rules: ['Read the premises carefully', 'Decide if the conclusion follows logically', 'Press Valid or Invalid based on logic alone', 'Dont let real-world knowledge override strict logic'] }
        };

        var info = descriptions[slug] || { desc: '', rules: [] };
        var categoryLabel = CATEGORY_META[reg.category] ? CATEGORY_META[reg.category].label : reg.category;

        $('#start-card-image').attr('src', reg.image);
        $('#start-title').text(reg.name);
        $('#start-description').text(info.desc);
        $('#start-difficulty-tag').text(reg.difficulty).attr('class', 'start-tag start-tag-difficulty-' + reg.difficulty.toLowerCase());
        $('#start-category-tag').text(categoryLabel);

        var $rules = $('#start-rules-list');
        $rules.empty();
        info.rules.forEach(function (rule) {
            $rules.append('<li>' + escapeHtml(rule) + '</li>');
        });

        // Hide personal best until loaded
        $('#start-personal-best').addClass('hidden');

        // Try to load personal best for this game
        if (window.CerebroAuth && CerebroAuth.isAuthenticated()) {
            CerebroAPI.get('/scores/history', { game: slug, limit: 1 })
                .done(function (response) {
                    var scores = response.scores || [];
                    if (scores.length > 0 && scores[0].score > 0) {
                        $('#start-pb-value').text(Number(scores[0].score).toLocaleString());
                        $('#start-personal-best').removeClass('hidden');
                    }
                })
                .fail(function () {});
        }

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

        $('.game-category-group').each(function () {
            var matches = activeCategoryFilter === 'all' || $(this).data('category-group') === activeCategoryFilter;
            $(this).toggleClass('is-hidden', !matches);
        });
    }

    function getCategoryOrder() {
        return ['memory', 'attention', 'logic', 'speed'];
    }

    function getGamesForCategory(category) {
        return Object.keys(GAMES).filter(function (slug) {
            return GAMES[slug].category === category;
        });
    }

    function renderLandingCategories() {
        var $container = $('#landing-category-strip');
        if ($container.length === 0) {
            return;
        }

        var html = '';
        getCategoryOrder().forEach(function (category) {
            var meta = CATEGORY_META[category];
            var count = getGamesForCategory(category).length;

            html += '<button class="category-card" type="button" data-category="' + escapeHtml(category) + '">';
            html += '<span class="card-icon">' + escapeHtml(meta.icon) + ' ' + escapeHtml(meta.kicker) + '</span>';
            html += '<h3>' + escapeHtml(meta.label) + '</h3>';
            html += '<p>' + escapeHtml(meta.description) + '</p>';
            html += '<span class="category-count">' + count + ' drills</span>';
            html += '</button>';
        });

        $container.html(html);
    }

    function renderGamesCatalog() {
        renderFilterBar();
        renderCategorySections();
    }

    function renderFilterBar() {
        var $container = $('#games-filter-bar');
        if ($container.length === 0) {
            return;
        }

        var html = '<button class="filter-chip active" type="button" data-category-filter="all">All Drills</button>';
        getCategoryOrder().forEach(function (category) {
            html += '<button class="filter-chip" type="button" data-category-filter="' + escapeHtml(category) + '">' + escapeHtml(CATEGORY_META[category].label) + '</button>';
        });

        $container.html(html);
    }

    function renderCategorySections() {
        var $container = $('#games-category-sections');
        if ($container.length === 0) {
            return;
        }

        var html = '';

        getCategoryOrder().forEach(function (category) {
            var meta = CATEGORY_META[category];
            var slugs = getGamesForCategory(category);

            html += '<section class="game-category-group" data-category-group="' + escapeHtml(category) + '">';
            html += '<div class="game-category-heading">';
            html += '<div>';
            html += '<span class="game-category-kicker">' + escapeHtml(meta.kicker) + '</span>';
            html += '<h3>' + escapeHtml(meta.label) + '</h3>';
            html += '</div>';
            html += '<p>' + escapeHtml(meta.description) + '</p>';
            html += '</div>';
            html += '<div class="games-grid">';

            slugs.forEach(function (slug) {
                html += renderGameCard(slug, GAMES[slug]);
            });

            html += '</div>';
            html += '</section>';
        });

        $container.html(html);
    }

    function renderGameCard(slug, game) {
        var difficultyClass = 'difficulty-' + game.difficulty.toLowerCase();
        var categoryLabel = CATEGORY_META[game.category] ? CATEGORY_META[game.category].label : game.category;
        var imageAlt = game.name + ' drill artwork';

        var html = '';
        html += '<article class="game-card" data-category="' + escapeHtml(game.category) + '" id="game-card-' + escapeHtml(slug) + '">';
        html += '<div class="game-card-visual">';
        html += '<img class="game-card-image" src="' + escapeHtml(game.image) + '" alt="' + escapeHtml(imageAlt) + '">';
        html += '<div class="game-card-image-overlay"></div>';
        html += '<div class="game-card-visual-copy">';
        html += '<span class="game-card-kicker">' + escapeHtml(categoryLabel) + '</span>';
        html += '<strong>' + escapeHtml(game.mode) + '</strong>';
        html += '</div>';
        html += '</div>';
        html += '<div class="game-card-top">';
        html += '<span class="game-card-badge ' + escapeHtml(difficultyClass) + '">' + escapeHtml(game.difficulty) + '</span>';
        html += '<span class="game-card-icon">' + escapeHtml(game.skill) + '</span>';
        html += '</div>';
        html += '<div class="game-card-copy">';
        html += '<h3>' + escapeHtml(game.name) + '</h3>';
        html += '<p>' + escapeHtml(game.description) + '</p>';
        html += '</div>';
        html += '<div class="game-card-stats">';
        html += '<span><strong>Skill</strong> ' + escapeHtml(game.skill) + '</span>';
        html += '<span><strong>Duration</strong> ' + escapeHtml(game.duration) + '</span>';
        html += '<span><strong>Mode</strong> ' + escapeHtml(game.mode) + '</span>';
        html += '</div>';
        html += '<button class="btn btn-primary game-card-cta btn-play" type="button" data-game="' + escapeHtml(slug) + '">Launch Drill</button>';
        html += '</article>';

        return html;
    }

    function cleanupCurrentGame() {
        if (activeGameModule && activeGameModule.cleanup) {
            activeGameModule.cleanup();
        }

        activeGameModule = null;
        currentGame = null;
        // Reset game board
        $('#game-board').empty().show();
        $('#display-lives').html('<span class="heart">♥</span><span class="heart">♥</span><span class="heart">♥</span>');
        $('#progress-bar-container').addClass('hidden').empty();
        $('#display-timer-badge').hide();
        $('.performance-meter').addClass('hidden');
        $('#result-badge').addClass('hidden');
        $('#modal-tier-badge').addClass('hidden');
        // Reset game area category
        $('#game-area').removeClass('category-memory category-attention category-logic category-speed');
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

    // ══════════════════════════════════════════════════════
    // STATISTICS DASHBOARD
    // ══════════════════════════════════════════════════════

    function loadStats() {
        var gameSlugs = Object.keys(GAMES);
        var allScores = [];
        var loaded = 0;

        function finalize() {
            renderStats(allScores);
        }

        if (gameSlugs.length === 0) { finalize(); return; }

        gameSlugs.forEach(function (slug) {
            var req = CerebroAPI.get('/scores/history', { game: slug, limit: 20 });
            req.done(function (response) {
                var scores = response.scores || [];
                scores.forEach(function (s) { s.game = slug; });
                allScores = allScores.concat(scores);
            });
            req.fail(function () {
                // Silently skip failed stats queries
            });
            req.then(function () {
                loaded++;
                if (loaded >= gameSlugs.length) finalize();
            });
        });
    }

    function renderStats(allScores) {
        var gameSlugs = Object.keys(GAMES);

        // Overall stats
        var totalSessions = allScores.length;
        var totalAccuracy = 0;
        var accuracyCount = 0;
        var bestScore = 0;
        var bestTier = '';
        var totalMs = 0;

        // Per-category accuracy
        var catData = {};
        gameSlugs.forEach(function (slug) {
            var cat = GAMES[slug].category;
            if (!catData[cat]) catData[cat] = { total: 0, correct: 0, count: 0 };
        });

        // Per-game bests
        var gameBests = {};
        gameSlugs.forEach(function (slug) { gameBests[slug] = 0; });

        allScores.forEach(function (s) {
            var score = Number(s.score || 0);
            if (score > bestScore) bestScore = score;
            if (score > (gameBests[s.game] || 0)) gameBests[s.game] = score;

            totalMs += Number(s.duration_ms || 0);

            var acc = Number(s.accuracy || 0);
            if (acc > 0) {
                totalAccuracy += acc;
                accuracyCount++;
                var cat = GAMES[s.game] ? GAMES[s.game].category : null;
                if (cat && catData[cat]) {
                    catData[cat].total += acc;
                    catData[cat].count++;
                }
            }
        });

        // Determine best tier
        var tierThresholds = [
            { min: 5000, label: 'Tier IV' }, { min: 2000, label: 'Tier III' },
            { min: 1000, label: 'Tier II' }, { min: 500, label: 'Tier I' }
        ];
        for (var t = 0; t < tierThresholds.length; t++) {
            if (bestScore >= tierThresholds[t].min) { bestTier = tierThresholds[t].label; break; }
        }
        if (!bestTier && totalSessions > 0) bestTier = 'Unranked';

        // Format time
        var totalSec = Math.round(totalMs / 1000);
        var timeStr = totalSec >= 3600
            ? Math.floor(totalSec / 3600) + 'h ' + Math.floor((totalSec % 3600) / 60) + 'm'
            : totalSec >= 60
                ? Math.floor(totalSec / 60) + 'm ' + (totalSec % 60) + 's'
                : totalSec + 's';

        var avgAcc = accuracyCount > 0 ? Math.round(totalAccuracy / accuracyCount) : 0;

        // Render overview
        $('#stat-total-sessions .stat-card-value').text(totalSessions);
        $('#stat-total-time .stat-card-value').text(timeStr);
        $('#stat-avg-accuracy .stat-card-value').text(avgAcc > 0 ? avgAcc + '%' : '—');
        $('#stat-best-tier .stat-card-value').text(bestTier);

        // Render category breakdown
        var catLabels = { memory: 'Memory', attention: 'Attention', logic: 'Logic', speed: 'Speed' };
        var $catGrid = $('#stats-categories');
        $catGrid.empty();
        Object.keys(catData).forEach(function (cat) {
            var d = catData[cat];
            var catAcc = d.count > 0 ? Math.round(d.total / d.count) : 0;
            var barWidth = catAcc > 0 ? catAcc + '%' : '0%';
            var html =
                '<div class="stat-cat-card category-' + cat + '">' +
                    '<div class="stat-cat-header">' +
                        '<span class="stat-cat-name">' + (catLabels[cat] || cat) + '</span>' +
                        '<span class="stat-cat-value">' + (catAcc > 0 ? catAcc + '%' : '—') + '</span>' +
                    '</div>' +
                    '<div class="stat-bar-track"><div class="stat-bar-fill" style="width: ' + barWidth + '"></div></div>' +
                    '<div class="stat-cat-sessions">' + d.count + ' session' + (d.count !== 1 ? 's' : '') + '</div>' +
                '</div>';
            $catGrid.append(html);
        });

        // Render game bests
        var $gameGrid = $('#stats-games');
        $gameGrid.empty();
        gameSlugs.forEach(function (slug) {
            var reg = GAMES[slug];
            var best = gameBests[slug] || 0;
            var html =
                '<div class="stat-game-card">' +
                    '<div class="stat-game-name">' + escapeHtml(reg.name) + '</div>' +
                    '<div class="stat-game-category stat-cat-' + reg.category + '">' + (catLabels[reg.category] || reg.category) + '</div>' +
                    '<div class="stat-game-best">' + (best > 0 ? best.toLocaleString() : '—') + '</div>' +
                '</div>';
            $gameGrid.append(html);
        });
    }

    function init() {
        renderLandingCategories();
        renderGamesCatalog();
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

    // ══════════════════════════════════════════════════════
    // SHARED GAME HELPERS (used by game engines)
    // ══════════════════════════════════════════════════════

    function animateScore(targetScore) {
        $('#result-score').text(0);
        if (targetScore > 0) {
            var scoreAnim = setInterval(function () {
                var current = parseInt($('#result-score').text(), 10);
                var step = Math.max(1, Math.floor(targetScore / 30));
                var next = Math.min(current + step, targetScore);
                $('#result-score').text(next);
                if (next >= targetScore) clearInterval(scoreAnim);
            }, 40);
        }
    }

    function setTierBadge(score) {
        var tier = '';
        var tierIcon = '◈';
        if (score > 5000) { tier = 'Tier IV: Neural Adept'; tierIcon = '◈'; }
        else if (score > 2000) { tier = 'Tier III: Synaptic Pilot'; tierIcon = '◆'; }
        else if (score > 1000) { tier = 'Tier II: Cortex Scout'; tierIcon = '◇'; }
        else if (score > 500) { tier = 'Tier I: Synapse Explorer'; tierIcon = '○'; }
        if (tier) {
            $('#tier-label').text(tier);
            $('#tier-icon').text(tierIcon);
            $('#modal-tier-badge').removeClass('hidden');
        } else {
            $('#modal-tier-badge').addClass('hidden');
        }
    }

    function spawnConfetti() {
        var $container = $('#confetti-container');
        if ($container.length === 0) return;
        var colors = ['#366758', '#b5ead7', '#ffdac1', '#e2f0cb', '#f6d770', '#ff7675'];
        for (var i = 0; i < 20; i++) {
            var $piece = $('<div>')
                .addClass('confetti-piece')
                .css({
                    '--cx': (Math.random() * 120 - 60) + 'px',
                    '--cy': (Math.random() * -100 - 20) + 'px',
                    '--cr': (Math.random() * 360) + 'deg',
                    'left': '50%',
                    'top': '50%',
                    'background': colors[i % colors.length],
                    'animation-delay': (Math.random() * 0.3) + 's'
                });
            $container.append($piece);
            setTimeout(function () { $piece.remove(); }, 2000);
        }
    }

    function updatePerformanceMeters(data) {
        if (!data) {
            $('#performance-meter').addClass('hidden');
            return;
        }
        $('#performance-meter').removeClass('hidden');
        if (data.accuracy !== undefined) {
            $('#meter-accuracy').css('width', data.accuracy + '%');
            $('#meter-accuracy-label').text(data.accuracy + '%');
        }
        if (data.reaction !== undefined) {
            var reactionScore = Math.min(100, Math.round((1000 / Math.max(data.reaction, 1)) * 50));
            $('#meter-reaction').css('width', reactionScore + '%');
            $('#meter-reaction-label').text(data.reaction + 'ms');
        }
        if (data.streak !== undefined) {
            var streakScore = Math.min(100, data.streak * 20);
            $('#meter-streak').css('width', streakScore + '%');
            $('#meter-streak-label').text(data.streak);
        }
    }

    return {
        showView: showView,
        launchGame: launchGame,
        init: init,
        GAMES: GAMES,
        // Shared game helpers
        animateScore: animateScore,
        setTierBadge: setTierBadge,
        spawnConfetti: spawnConfetti,
        updatePerformanceMeters: updatePerformanceMeters
    };

})(jQuery);
