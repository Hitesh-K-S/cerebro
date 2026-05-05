/**
 * Cerebro — Impulse Guard Game Engine
 *
 * Inhibitory control: Go/No-Go task with shape-based stimuli.
 */

'use strict';

var ImpulseGuard = (function ($) {

    var STATES = {
        INIT: 'INIT', COUNTDOWN: 'COUNTDOWN', PLAYING: 'PLAYING',
        RULE_CHANGE: 'RULE_CHANGE', PAUSE: 'PAUSE', RESULTS: 'RESULTS'
    };

    var SHAPES = ['ig-circle', 'ig-square', 'ig-triangle', 'ig-diamond', 'ig-pentagon', 'ig-hexagon'];
    var COLORS = ['color-teal', 'color-coral', 'color-violet', 'color-amber', 'color-mint', 'color-pink'];

    var DIFFICULTY = [
        { displayMs: 1200, count: 30, nogoRate: 0.20, pool: 3, ruleChanges: 0 },
        { displayMs: 1000, count: 35, nogoRate: 0.20, pool: 4, ruleChanges: 1 },
        { displayMs: 800, count: 40, nogoRate: 0.25, pool: 5, ruleChanges: 1 },
        { displayMs: 700, count: 45, nogoRate: 0.25, pool: 5, ruleChanges: 2 },
        { displayMs: 600, count: 50, nogoRate: 0.30, pool: 6, ruleChanges: 2 },
    ];

    var state = STATES.INIT;
    var level = 1, score = 0;
    var stimuli = [];
    var currentIndex = -1;
    var forbiddenShape = '';
    var tapped = false;
    var stimulusTimeout = null;
    var ruleChangeAt = [];
    var sessionToken = null;
    var gameTimer = CerebroTimer.create();
    var reactionTimer = CerebroTimer.create();
    var responses = [];

    // Stats
    var goCorrect = 0, goMissed = 0, nogoCorrect = 0, commissionErrors = 0;

    function getDifficulty(lvl) {
        return lvl <= DIFFICULTY.length ? DIFFICULTY[lvl - 1] : DIFFICULTY[DIFFICULTY.length - 1];
    }

    // ══════════════════════════════════════════════════════
    // SEQUENCE GENERATION
    // ══════════════════════════════════════════════════════

    function generateSequence() {
        var diff = getDifficulty(level);
        var pool = SHAPES.slice(0, diff.pool);
        stimuli = [];

        // Pick initial forbidden shape
        forbiddenShape = pool[Math.floor(Math.random() * pool.length)];

        // Schedule rule changes
        ruleChangeAt = [];
        if (diff.ruleChanges > 0) {
            var interval = Math.floor(diff.count / (diff.ruleChanges + 1));
            for (var r = 1; r <= diff.ruleChanges; r++) {
                ruleChangeAt.push(r * interval);
            }
        }

        for (var i = 0; i < diff.count; i++) {
            var isNogo = Math.random() < diff.nogoRate;
            var shape, color;

            if (isNogo) {
                shape = forbiddenShape;
            } else {
                do {
                    shape = pool[Math.floor(Math.random() * pool.length)];
                } while (shape === forbiddenShape);
            }

            color = COLORS[Math.floor(Math.random() * COLORS.length)];
            stimuli.push({ shape: shape, color: color, isNogo: isNogo, ruleChangeBefore: ruleChangeAt.indexOf(i) >= 0 });
        }
    }

    // ══════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════

    function buildUI() {
        var $c = $('#ig-container');
        if ($c.length === 0) { $c = $('<div id="ig-container"></div>').appendTo('#game-area'); }
        $('#pattern-grid').hide(); $('#game-start-screen').addClass('hidden');

        $c.html(
            '<div class="ig-instruction">Tap <em>every shape</em> — except the forbidden one!</div>' +
            '<div class="ig-forbidden" id="ig-forbidden">DON\'T TAP: <span id="ig-forbidden-preview"></span></div>' +
            '<div class="ig-stimulus-area" id="ig-stimulus"></div>' +
            '<div class="ig-progress" id="ig-progress"></div>'
        ).show();

        updateForbiddenPreview();
        buildProgressDots();
    }

    function updateForbiddenPreview() {
        var html = '<div class="ig-forbidden-shape ' + forbiddenShape + ' ' +
            COLORS[SHAPES.indexOf(forbiddenShape) % COLORS.length] + '"></div>';
        $('#ig-forbidden-preview').html(html);
    }

    function buildProgressDots() {
        var html = '';
        for (var i = 0; i < stimuli.length; i++) {
            html += '<div class="ig-dot" data-idx="' + i + '"></div>';
        }
        $('#ig-progress').html(html);
    }

    function showStimulus(stim) {
        var $area = $('#ig-stimulus');
        $area.removeClass('go-correct nogo-correct commission-error omission-error');
        var html = '<div class="ig-shape ' + stim.shape + ' ' + stim.color + '"></div>';
        $area.html(html);
    }

    function clearStimulus() {
        $('#ig-stimulus').html('').removeClass('go-correct nogo-correct commission-error omission-error');
    }

    function markDot(idx, cls) {
        $('#ig-progress .ig-dot[data-idx="' + idx + '"]').addClass(cls).removeClass('current');
    }

    function highlightDot(idx) {
        $('#ig-progress .ig-dot').removeClass('current');
        $('#ig-progress .ig-dot[data-idx="' + idx + '"]').addClass('current');
    }

    // ══════════════════════════════════════════════════════
    // GAMEPLAY
    // ══════════════════════════════════════════════════════

    function nextStimulus() {
        currentIndex++;

        if (currentIndex >= stimuli.length) {
            endGame();
            return;
        }

        var stim = stimuli[currentIndex];

        // Rule change?
        if (stim.ruleChangeBefore) {
            showRuleChange(function () {
                presentStimulus(stim);
            });
            return;
        }

        presentStimulus(stim);
    }

    function presentStimulus(stim) {
        var diff = getDifficulty(level);
        tapped = false;
        highlightDot(currentIndex);
        showStimulus(stim);
        reactionTimer.reset().start();

        clearTimeout(stimulusTimeout);
        stimulusTimeout = setTimeout(function () {
            if (!tapped) {
                handleNoTap();
            }
        }, diff.displayMs);
    }

    function handleTap() {
        if (state !== STATES.PLAYING || tapped) return;
        tapped = true;
        reactionTimer.stop();
        clearTimeout(stimulusTimeout);

        var stim = stimuli[currentIndex];
        var reactionMs = reactionTimer.getElapsedMs();
        var diff = getDifficulty(level);
        var $area = $('#ig-stimulus');

        if (stim.isNogo) {
            // Commission error — tapped the forbidden shape
            commissionErrors++;
            score -= 150;
            $area.addClass('commission-error');
            markDot(currentIndex, 'commission-error');
        } else {
            // Correct go
            goCorrect++;
            var speedBonus = Math.max(0.3, 1.0 - (reactionMs / diff.displayMs));
            score += Math.round(80 * speedBonus);
            $area.addClass('go-correct');
            markDot(currentIndex, 'go-correct');
        }

        responses.push({ stimulusIndex: currentIndex, tapped: true, reactionMs: reactionMs });
        score = Math.max(0, score);
        updateDisplay();

        setTimeout(function () { clearStimulus(); setTimeout(nextStimulus, 200); }, 250);
    }

    function handleNoTap() {
        tapped = true;
        var stim = stimuli[currentIndex];
        var $area = $('#ig-stimulus');

        if (stim.isNogo) {
            // Correct no-go (inhibition success)
            nogoCorrect++;
            score += 120;
            $area.addClass('nogo-correct');
            markDot(currentIndex, 'nogo-correct');
        } else {
            // Omission error — missed a go stimulus
            goMissed++;
            score -= 20;
            $area.addClass('omission-error');
            markDot(currentIndex, 'omission-error');
        }

        responses.push({ stimulusIndex: currentIndex, tapped: false, reactionMs: null });
        score = Math.max(0, score);
        updateDisplay();

        setTimeout(function () { clearStimulus(); setTimeout(nextStimulus, 200); }, 300);
    }

    function showRuleChange(callback) {
        state = STATES.RULE_CHANGE;
        var diff = getDifficulty(level);
        var pool = SHAPES.slice(0, diff.pool);

        // Pick new forbidden shape
        var oldForbidden = forbiddenShape;
        do {
            forbiddenShape = pool[Math.floor(Math.random() * pool.length)];
        } while (forbiddenShape === oldForbidden);

        // Update remaining stimuli
        for (var i = currentIndex; i < stimuli.length; i++) {
            stimuli[i].isNogo = (stimuli[i].shape === forbiddenShape);
        }

        updateForbiddenPreview();

        var color = COLORS[SHAPES.indexOf(forbiddenShape) % COLORS.length];
        var $overlay = $('<div class="ig-rule-change" id="ig-rule-overlay">' +
            '<h3>⚠ Rule Change!</h3>' +
            '<p>New forbidden shape:</p>' +
            '<div class="ig-shape ' + forbiddenShape + ' ' + color + '" style="width:60px;height:60px;margin:12px auto;"></div>' +
            '</div>');

        $('#ig-container').css('position', 'relative').append($overlay);

        setTimeout(function () {
            $('#ig-rule-overlay').remove();
            state = STATES.PLAYING;
            callback();
        }, 1500);
    }

    // ══════════════════════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════════════════════

    function startGame() {
        score = 0; level = 1; currentIndex = -1;
        goCorrect = goMissed = nogoCorrect = commissionErrors = 0;
        responses = []; sessionToken = null;
        generateSequence();
        buildUI();
        gameTimer.reset().start();

        CerebroAPI.post('/game/start', { game_slug: 'impulse-guard' })
            .done(function (r) { sessionToken = r.token; }).fail(function () { });

        updateDisplay();
        runCountdown(function () {
            state = STATES.PLAYING;
            setStatus('Tap every shape — except the forbidden one!', 'your-turn');
            nextStimulus();
        });
    }

    function endGame() {
        state = STATES.RESULTS;
        gameTimer.stop();
        clearTimeout(stimulusTimeout);

        var total = stimuli.length;
        var acc = ((goCorrect + nogoCorrect) / total * 100).toFixed(1);

        // Bonus for low commission errors
        score += Math.max(0, 500 - (commissionErrors * 100));
        score = Math.max(0, score);

        $('#result-score').text(score);
        $('#result-level').text(level);
        $('#result-rounds').text(commissionErrors + ' false taps');
        $('#result-time').text(gameTimer.getFormatted());
        var title = commissionErrors === 0 ? 'Perfect Control! 🛡️' :
            commissionErrors <= 2 ? 'Strong Willpower! 💪' : 'Keep Practicing! ⚡';
        $('#modal-title').text(title);
        $('#result-badge').addClass('hidden');
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            CerebroAPI.post('/game/end', {
                token: sessionToken, score: score, level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: {
                    rounds: [{
                        sequence: stimuli.map(function (s) { return s.isNogo ? 1 : 0; }),
                        input: responses.map(function (r) { return r.tapped ? 1 : 0; }),
                        time_ms: gameTimer.getElapsedMs()
                    }]
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
        $('#display-round').text((currentIndex + 1) + '/' + stimuli.length);
        $('#display-score').text('Score: ' + score);
    }

    function bindEvents() {
        $(document).off('.impulseguard');
        $(document).on('click.impulseguard', '#ig-stimulus', function () { handleTap(); });
        // Keyboard: Space to tap
        $(document).on('keydown.impulseguard', function (e) {
            if (e.code === 'Space' && state === STATES.PLAYING) { e.preventDefault(); handleTap(); }
        });
        $(document).on('visibilitychange.impulseguard', function () {
            if (document.hidden && state === STATES.PLAYING) { clearTimeout(stimulusTimeout); state = STATES.PAUSE; }
        });
    }

    function init() { bindEvents(); }

    function cleanup() {
        clearTimeout(stimulusTimeout);
        $(document).off('.impulseguard');
        $('#ig-container').remove(); $('#pattern-grid').show();
        state = STATES.INIT;
    }

    return {
        slug: 'impulse-guard', name: 'Impulse Guard', category: 'attention',
        init: init, startGame: startGame, cleanup: cleanup,
        getState: function () { return { state: state, score: score }; }, STATES: STATES
    };
})(jQuery);
