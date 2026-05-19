/**
 * Cerebro — Attention Control Game Engine
 */

'use strict';

var AttentionControl = (function ($) {

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        PLAYING: 'PLAYING',
        RULE_CHANGE: 'RULE_CHANGE',
        GAME_OVER: 'GAME_OVER'
    };

    var COLORS = [
        { key: 'blue', label: 'Blue' },
        { key: 'amber', label: 'Amber' },
        { key: 'mint', label: 'Mint' },
        { key: 'rose', label: 'Rose' }
    ];

    var SHAPES = [
        { key: 'circle', label: 'Circle' },
        { key: 'square', label: 'Square' },
        { key: 'triangle', label: 'Triangle' },
        { key: 'diamond', label: 'Diamond' }
    ];

    var DIFFICULTY = [
        { count: 20, displayMs: 1300, targetRate: 0.28, ruleChanges: 0 },
        { count: 24, displayMs: 1100, targetRate: 0.24, ruleChanges: 1 },
        { count: 28, displayMs: 950, targetRate: 0.22, ruleChanges: 1 },
        { count: 32, displayMs: 850, targetRate: 0.2, ruleChanges: 2 }
    ];

    var state = STATES.INIT;
    var level = 1, round = 1, score = 0;
    var sessionToken = null, gameTimer = null, reactionTimer = null;
    var stimuli = [], currentIndex = -1, currentRule = null, currentStimulus = null;
    var responses = [], bestStreak = 0, streak = 0, hits = 0, misses = 0, falseAlarms = 0, correctRejects = 0;
    var stimulusTimeoutId = null, rulePauseId = null, countdownIntervalId = null;
    var $board, $statusText, $startScreen, $displayLevel, $displayRound, $displayScore, $displayLives;

    function cacheDom() {
        $board = $('#game-board');
        $statusText = $('#status-text');
        $startScreen = $('#game-start-screen');
        $displayLevel = $('#display-level');
        $displayRound = $('#display-round');
        $displayScore = $('#display-score');
        $displayLives = $('#display-lives');
    }

    function getDifficulty(lvl) {
        return lvl <= DIFFICULTY.length ? DIFFICULTY[lvl - 1] : DIFFICULTY[DIFFICULTY.length - 1];
    }

    function clearTimers() {
        clearTimeout(stimulusTimeoutId);
        clearTimeout(rulePauseId);
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
    }

    function init() {
        cacheDom();
        bindEvents();
        state = STATES.INIT;
    }

    function resetGame() {
        clearTimers();
        state = STATES.INIT;
        level = 1; round = 1; score = 0;
        sessionToken = null; stimuli = []; currentIndex = -1; currentRule = null; currentStimulus = null;
        responses = []; bestStreak = 0; streak = 0; hits = 0; misses = 0; falseAlarms = 0; correctRejects = 0;
        if (gameTimer) gameTimer.reset();
        if (reactionTimer) reactionTimer.reset();
    }

    function renderFrame() {
        $board.empty().removeClass().addClass('game-board attention-control-board');
        $board.html(
            '<div class="ac-shell">' +
                '<div class="ac-rule-card" id="ac-rule-card"></div>' +
                '<div class="ac-stimulus-area" id="ac-stimulus-area"></div>' +
                '<div class="ac-progress" id="ac-progress"></div>' +
            '</div>'
        );
    }

    function runCountdown() {
        var count = 3;
        $('#countdown-overlay').removeClass('hidden');
        $('#countdown-number').text(count);
        countdownIntervalId = setInterval(function () {
            count--;
            if (count > 0) $('#countdown-number').text(count);
            else {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
                $('#countdown-overlay').addClass('hidden');
                startLevel();
            }
        }, 1000);
    }

    function pickRule() {
        return {
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)]
        };
    }

    function generateStimuli() {
        var diff = getDifficulty(level);
        stimuli = [];
        var changes = [];
        if (diff.ruleChanges > 0) {
            var interval = Math.floor(diff.count / (diff.ruleChanges + 1));
            for (var i = 1; i <= diff.ruleChanges; i++) changes.push(i * interval);
        }
        for (var idx = 0; idx < diff.count; idx++) {
            var shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            var color = COLORS[Math.floor(Math.random() * COLORS.length)];
            var makeTarget = Math.random() < diff.targetRate;
            if (makeTarget) {
                shape = currentRule.shape;
                color = currentRule.color;
            } else {
                if (Math.random() > 0.5) shape = SHAPES.filter(function (entry) { return entry.key !== currentRule.shape.key; })[Math.floor(Math.random() * 3)];
                else color = COLORS.filter(function (entry) { return entry.key !== currentRule.color.key; })[Math.floor(Math.random() * 3)];
            }
            stimuli.push({ shape: shape, color: color, isTarget: shape.key === currentRule.shape.key && color.key === currentRule.color.key, ruleChangeBefore: changes.indexOf(idx) >= 0 });
        }
    }

    function renderRule() {
        $('#ac-rule-card').html(
            '<span class="ac-kicker">Current Rule</span>' +
            '<h3>Tap only if the stimulus is <span>' + escapeHtml(currentRule.color.label) + '</span> and <span>' + escapeHtml(currentRule.shape.label) + '</span>.</h3>'
        );
    }

    function buildProgress() {
        var html = '';
        for (var i = 0; i < stimuli.length; i++) html += '<span class="ac-dot" data-idx="' + i + '"></span>';
        $('#ac-progress').html(html);
    }

    function startLevel() {
        currentRule = pickRule();
        generateStimuli();
        renderRule();
        buildProgress();
        currentIndex = -1;
        setStatus('Respond only to the exact target rule.', 'watching');
        nextStimulus();
    }

    function nextStimulus() {
        currentIndex++;
        if (currentIndex >= stimuli.length) {
            endGame();
            return;
        }
        currentStimulus = stimuli[currentIndex];
        if (currentStimulus.ruleChangeBefore) {
            state = STATES.RULE_CHANGE;
            currentRule = pickRule();
            renderRule();
            $('#ac-stimulus-area').html('<div class="ac-banner">Rule changed. Reset your focus.</div>');
            rulePauseId = setTimeout(function () {
                generateRemainingTargets();
                presentStimulus();
            }, 900);
            return;
        }
        presentStimulus();
    }

    function generateRemainingTargets() {
        for (var i = currentIndex; i < stimuli.length; i++) {
            var shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            var color = COLORS[Math.floor(Math.random() * COLORS.length)];
            var makeTarget = Math.random() < getDifficulty(level).targetRate;
            if (makeTarget) {
                shape = currentRule.shape;
                color = currentRule.color;
            } else {
                if (Math.random() > 0.5) shape = SHAPES.filter(function (entry) { return entry.key !== currentRule.shape.key; })[Math.floor(Math.random() * 3)];
                else color = COLORS.filter(function (entry) { return entry.key !== currentRule.color.key; })[Math.floor(Math.random() * 3)];
            }
            stimuli[i] = { shape: shape, color: color, isTarget: shape.key === currentRule.shape.key && color.key === currentRule.color.key, ruleChangeBefore: false };
        }
        currentStimulus = stimuli[currentIndex];
    }

    function presentStimulus() {
        state = STATES.PLAYING;
        var stim = currentStimulus;
        round = currentIndex + 1;
        $('.ac-dot').removeClass('current');
        $('.ac-dot[data-idx="' + currentIndex + '"]').addClass('current');
        $('#ac-stimulus-area').html('<button class="ac-target ac-color-' + stim.color.key + ' ac-shape-' + stim.shape.key + '" id="ac-target-btn" type="button" aria-label="Stimulus"></button>');
        reactionTimer.reset().start();
        setStatus('Tap only true matches. Ignore partial matches.', 'your-turn');
        clearTimeout(stimulusTimeoutId);
        stimulusTimeoutId = setTimeout(function () {
            handleNoTap();
        }, getDifficulty(level).displayMs);
    }

    function handleTap() {
        if (state !== STATES.PLAYING) return;
        reactionTimer.stop();
        clearTimeout(stimulusTimeoutId);
        var reaction = reactionTimer.getElapsedMs();
        if (currentStimulus.isTarget) {
            hits++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            score += 90 + Math.max(0, 70 - Math.floor(reaction / 25));
            markDot('hit');
            if (window.CerebroSound) CerebroSound.correct();
        } else {
            falseAlarms++;
            streak = 0;
            score = Math.max(0, score - 70);
            markDot('false');
            if (window.CerebroSound) CerebroSound.wrong();
        }
        responses.push({ target: currentStimulus.isTarget, tapped: true, reaction_ms: reaction });
        updateDisplay();
        setTimeout(nextStimulus, 220);
    }

    function handleNoTap() {
        if (state !== STATES.PLAYING) return;
        if (currentStimulus.isTarget) {
            misses++;
            streak = 0;
            score = Math.max(0, score - 25);
            markDot('miss');
            if (window.CerebroSound) CerebroSound.wrong();
        } else {
            correctRejects++;
            score += 40;
            markDot('reject');
            if (window.CerebroSound) CerebroSound.tap();
        }
        responses.push({ target: currentStimulus.isTarget, tapped: false, reaction_ms: null });
        updateDisplay();
        setTimeout(nextStimulus, 220);
    }

    function markDot(cls) {
        $('.ac-dot[data-idx="' + currentIndex + '"]').removeClass('current').addClass(cls);
    }

    function endGame() {
        state = STATES.GAME_OVER;
        gameTimer.stop();
        var total = hits + misses + falseAlarms + correctRejects;
        var acc = total ? Math.round(((hits + correctRejects) / total) * 100) : 0;
        $('#result-level').text(level);
        $('#result-rounds').text((hits + correctRejects) + '/' + total + ' correct');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(acc >= 85 ? 'Focus Rule Held' : acc >= 65 ? 'Attention Improving' : 'Keep Refining Selective Focus');
        $('#result-badge').addClass('hidden');
        if (window.CerebroSound) CerebroSound.complete();
        if (window.CerebroApp && CerebroApp.animateScore) CerebroApp.animateScore(score); else $('#result-score').text(score);
        if (window.CerebroApp && CerebroApp.setTierBadge) CerebroApp.setTierBadge(score);
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) CerebroApp.updatePerformanceMeters({ accuracy: acc, reaction: averageReaction(), streak: bestStreak });
        $('#modal-gameover').removeClass('hidden');
        if (sessionToken) {
            var payload = {
                token: sessionToken,
                score: score,
                level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: { rounds: responses.map(function (entry) { return { sequence: [entry.target ? 1 : 0], input: [entry.tapped ? 1 : 0], time_ms: entry.reaction_ms || 0 }; }) },
                accuracy: acc
            };
            CerebroAPI.post('/game/end', payload).fail(function () { CerebroAPI.queueForRetry('POST', '/game/end', payload); });
        }
    }

    function averageReaction() {
        var values = responses.filter(function (entry) { return entry.tapped && entry.target && entry.reaction_ms; }).map(function (entry) { return entry.reaction_ms; });
        if (!values.length) return 0;
        return Math.round(values.reduce(function (sum, value) { return sum + value; }, 0) / values.length);
    }

    function updateDisplay() {
        $displayLevel.text('Lv.' + level);
        $displayRound.text('R' + round + '/' + stimuli.length);
        $displayScore.text(score);
        $displayLives.html('<span class="heart">♥</span><span class="heart">♥</span><span class="heart">♥</span>');
    }

    function setStatus(text, cls) {
        var $status = $('#game-status');
        $status.removeClass('watching your-turn correct wrong');
        if (cls) $status.addClass(cls);
        $statusText.text(text);
    }

    function bindEvents() {
        $(document).off('.attentioncontrol');
        $(document).on('click.attentioncontrol', '#ac-target-btn', handleTap);
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        reactionTimer = CerebroTimer.create();
        gameTimer.reset().start();
        renderFrame();
        updateDisplay();
        $startScreen.addClass('hidden');
        CerebroAPI.post('/game/start', { game_slug: 'attention-control' }).done(function (response) { sessionToken = response.token; }).fail(function () {});
        runCountdown();
    }

    function cleanup() {
        clearTimers();
        $(document).off('.attentioncontrol');
        if ($board) $board.empty().removeClass('attention-control-board');
        state = STATES.INIT;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    return { init: init, startGame: startGame, cleanup: cleanup, getState: function () { return { state: state, level: level, round: round, score: score }; }, STATES: STATES };

})(jQuery);
