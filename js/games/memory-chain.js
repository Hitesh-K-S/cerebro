/**
 * Cerebro — Memory Chain Game Engine
 */

'use strict';

var MemoryChain = (function ($) {

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        STUDY: 'STUDY',
        REBUILD: 'REBUILD',
        RELATION: 'RELATION',
        FEEDBACK: 'FEEDBACK',
        GAME_OVER: 'GAME_OVER'
    };

    var COUNTDOWN_SECONDS = 3;
    var TOTAL_ROUNDS = 5;
    var STUDY_MS = 4200;
    var FEEDBACK_MS = 1200;

    var state = STATES.INIT;
    var level = 1;
    var round = 1;
    var score = 0;
    var lives = 3;
    var correctCount = 0;
    var wrongCount = 0;
    var sessionToken = null;
    var gameTimer = null;
    var currentChain = null;
    var expectedOrder = [];
    var chosenOrder = [];
    var relationPrompt = null;
    var roundPhase = 'rebuild';
    var roundData = [];
    var timeouts = [];
    var streak = 0;
    var bestStreak = 0;
    var countdownIntervalId = null;

    var $board, $statusText, $startScreen;
    var $displayLevel, $displayRound, $displayScore, $displayLives;

    function cacheDom() {
        $board = $('#game-board');
        $statusText = $('#status-text');
        $startScreen = $('#game-start-screen');
        $displayLevel = $('#display-level');
        $displayRound = $('#display-round');
        $displayScore = $('#display-score');
        $displayLives = $('#display-lives');
    }

    function schedule(fn, ms) {
        var id = setTimeout(fn, ms);
        timeouts.push(id);
        return id;
    }

    function clearTimers() {
        while (timeouts.length) {
            clearTimeout(timeouts.pop());
        }
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
        level = 1;
        round = 1;
        score = 0;
        lives = 3;
        correctCount = 0;
        wrongCount = 0;
        sessionToken = null;
        currentChain = null;
        expectedOrder = [];
        chosenOrder = [];
        relationPrompt = null;
        roundPhase = 'rebuild';
        roundData = [];
        streak = 0;
        bestStreak = 0;
        if (gameTimer) gameTimer.reset();
    }

    function chainLength() {
        return Math.min(4 + Math.floor((level - 1) / 2), 6);
    }

    function renderFrame() {
        $board.empty().removeClass().addClass('game-board memory-chain-board');
        $board.html(
            '<div class="mc-shell">' +
                '<div class="mc-title" id="mc-title"></div>' +
                '<div class="mc-stage" id="mc-stage"></div>' +
            '</div>'
        );
    }

    function runCountdown() {
        var count = COUNTDOWN_SECONDS;
        $('#countdown-overlay').removeClass('hidden');
        $('#countdown-number').text(count);
        countdownIntervalId = setInterval(function () {
            count--;
            if (count > 0) {
                $('#countdown-number').text(count);
            } else {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
                $('#countdown-overlay').addClass('hidden');
                startRound();
            }
        }, 1000);
    }

    function startRound() {
        currentChain = CerebroMemoryContent.getChain(chainLength());
        expectedOrder = currentChain.steps.slice();
        chosenOrder = [];
        relationPrompt = null;
        roundPhase = 'rebuild';
        state = STATES.STUDY;
        $('#mc-title').text('Chain: ' + currentChain.title);
        setStatus('Study the sequence. Notice how each step leads to the next.', 'watching');
        renderStudyPhase();
        schedule(beginRebuildPhase, Math.max(2800, STUDY_MS - (level - 1) * 200));
    }

    function renderStudyPhase() {
        var html = '<div class="mc-study-list">';
        expectedOrder.forEach(function (step, index) {
            html += '<div class="mc-study-step">';
            html += '<span class="mc-step-number">' + (index + 1) + '</span>';
            html += '<span class="mc-step-label">' + escapeHtml(step) + '</span>';
            html += '</div>';
        });
        html += '</div>';
        $('#mc-stage').html(html);
        updateDisplay();
    }

    function beginRebuildPhase() {
        state = STATES.REBUILD;
        setStatus('Rebuild the sequence in the same order.', 'your-turn');
        renderRebuildPhase();
    }

    function renderRebuildPhase() {
        var shuffled = CerebroMemoryContent.shuffle(expectedOrder);
        var html = '<div class="mc-rebuild">';
        html += '<div class="mc-selected-row" id="mc-selected-row">';
        html += '<span class="mc-phase-kicker">Chosen order</span>';
        html += '<div class="mc-selected-list">';
        if (!chosenOrder.length) html += '<span class="mc-placeholder">Select each step in order</span>';
        chosenOrder.forEach(function (step) {
            html += '<span class="mc-chip locked">' + escapeHtml(step) + '</span>';
        });
        html += '</div></div>';
        html += '<div class="mc-choice-grid">';
        shuffled.forEach(function (step) {
            var disabled = chosenOrder.indexOf(step) !== -1 ? ' disabled' : '';
            html += '<button class="mc-choice-btn" data-step="' + escapeHtml(step) + '" type="button"' + disabled + '>' + escapeHtml(step) + '</button>';
        });
        html += '</div></div>';
        $('#mc-stage').html(html);
    }

    function chooseStep(step) {
        if (state !== STATES.REBUILD) return;
        if (chosenOrder.indexOf(step) !== -1) return;
        chosenOrder.push(step);
        if (window.CerebroSound) CerebroSound.tap();

        if (chosenOrder.length >= expectedOrder.length) {
            var rebuildCorrect = expectedOrder.every(function (item, index) {
                return chosenOrder[index] === item;
            });
            if (!rebuildCorrect) {
                finishRound(false, 'Wrong order. Build the links more deliberately.');
                return;
            }
            startRelationPhase();
            return;
        }

        renderRebuildPhase();
    }

    function startRelationPhase() {
        roundPhase = 'relation';
        state = STATES.RELATION;
        var index = Math.max(1, Math.floor(Math.random() * (expectedOrder.length - 1)));
        var target = expectedOrder[index];
        var correct = expectedOrder[index - 1];
        var options = [correct];
        CerebroMemoryContent.shuffle(expectedOrder).forEach(function (item) {
            if (item !== correct && item !== target && options.length < 4) options.push(item);
        });
        relationPrompt = { target: target, answer: correct, options: CerebroMemoryContent.shuffle(options) };
        setStatus('One more retrieval step: what came immediately before?', 'your-turn');

        var html = '<div class="mc-relation-card">';
        html += '<span class="mc-phase-kicker">Link Check</span>';
        html += '<h3>What came right before <span>' + escapeHtml(target) + '</span>?</h3>';
        html += '<div class="mc-choice-grid">';
        relationPrompt.options.forEach(function (option) {
            html += '<button class="mc-relation-btn" data-choice="' + escapeHtml(option) + '" type="button">' + escapeHtml(option) + '</button>';
        });
        html += '</div></div>';
        $('#mc-stage').html(html);
    }

    function answerRelation(choice) {
        if (state !== STATES.RELATION) return;
        finishRound(choice === relationPrompt.answer, choice === relationPrompt.answer ? 'Sequence locked in.' : 'Close. Associations need one more pass.');
    }

    function finishRound(correct, message) {
        state = STATES.FEEDBACK;
        var roundScore = 0;
        if (correct) {
            correctCount++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            roundScore = 150 + (level * 20) + (expectedOrder.length * 15);
            score += roundScore;
            if (window.CerebroSound) CerebroSound.correct();
            if (round % 2 === 1) level++;
        } else {
            wrongCount++;
            lives--;
            streak = 0;
            if (window.CerebroSound) CerebroSound.wrong();
            if (wrongCount % 2 === 0 && level > 1) level--;
        }

        roundData.push({
            chain: currentChain.title,
            correct: correct,
            phase: roundPhase,
            score: roundScore
        });

        setStatus(message, correct ? 'correct' : 'wrong');
        $('#mc-stage').html(
            '<div class="mc-feedback-card ' + (correct ? 'is-correct' : 'is-wrong') + '">' +
                '<span class="mc-phase-kicker">' + escapeHtml(currentChain.title) + '</span>' +
                '<h3>' + (correct ? 'Strong association' : 'Revisit the order') + '</h3>' +
                '<p>' + escapeHtml(expectedOrder.join(' -> ')) + '</p>' +
            '</div>'
        );
        updateDisplay();

        schedule(function () {
            round++;
            if (round > TOTAL_ROUNDS || lives <= 0) endGame();
            else startRound();
        }, FEEDBACK_MS);
    }

    function endGame() {
        state = STATES.GAME_OVER;
        gameTimer.stop();
        var total = correctCount + wrongCount;
        var acc = total ? Math.round((correctCount / total) * 100) : 0;
        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + TOTAL_ROUNDS + ' chains');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(acc >= 80 ? 'Associations Are Sticking' : acc >= 60 ? 'Memory Links Improving' : 'Keep Strengthening Links');
        $('#result-badge').addClass('hidden');

        if (window.CerebroSound) CerebroSound.complete();
        if (window.CerebroApp && CerebroApp.animateScore) CerebroApp.animateScore(score);
        else $('#result-score').text(score);
        if (window.CerebroApp && CerebroApp.setTierBadge) CerebroApp.setTierBadge(score);
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) {
            CerebroApp.updatePerformanceMeters({
                accuracy: acc,
                reaction: 0,
                streak: bestStreak
            });
        }
        $('#modal-gameover').removeClass('hidden');

        if (sessionToken) {
            var payload = {
                token: sessionToken,
                score: score,
                level_reached: level,
                duration_ms: gameTimer.getElapsedMs(),
                replay: { rounds: roundData.map(function (entry) {
                    return { sequence: [entry.chain], input: [entry.correct ? 1 : 0], time_ms: 0 };
                }) },
                accuracy: acc
            };
            CerebroAPI.post('/game/end', payload).fail(function () {
                CerebroAPI.queueForRetry('POST', '/game/end', payload);
            });
        }
    }

    function updateLives() {
        var html = '';
        for (var i = 0; i < 3; i++) {
            html += '<span class="heart">' + (i < lives ? '♥' : '♡') + '</span>';
        }
        $displayLives.html(html);
    }

    function updateDisplay() {
        $displayLevel.text('Lv.' + level);
        $displayRound.text('R' + round + '/' + TOTAL_ROUNDS);
        $displayScore.text(score);
        updateLives();
    }

    function setStatus(text, cls) {
        var $status = $('#game-status');
        $status.removeClass('watching your-turn correct wrong');
        if (cls) $status.addClass(cls);
        $statusText.text(text);
    }

    function bindEvents() {
        $(document).off('.memorychain');
        $(document).on('click.memorychain', '.mc-choice-btn', function () {
            chooseStep($(this).data('step'));
        });
        $(document).on('click.memorychain', '.mc-relation-btn', function () {
            answerRelation($(this).data('choice'));
        });
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        renderFrame();
        updateDisplay();
        $startScreen.addClass('hidden');
        CerebroAPI.post('/game/start', { game_slug: 'memory-chain' })
            .done(function (response) { sessionToken = response.token; })
            .fail(function () {});
        runCountdown();
    }

    function cleanup() {
        clearTimers();
        $(document).off('.memorychain');
        if ($board) $board.empty().removeClass('memory-chain-board');
        state = STATES.INIT;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    return {
        init: init,
        startGame: startGame,
        cleanup: cleanup,
        getState: function () { return { state: state, level: level, round: round, score: score }; },
        STATES: STATES
    };

})(jQuery);
