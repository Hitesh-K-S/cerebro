/**
 * Cerebro — Fact Loop Game Engine
 */

'use strict';

var FactLoop = (function ($) {

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        STUDY: 'STUDY',
        INTERFERE: 'INTERFERE',
        RECALL: 'RECALL',
        FEEDBACK: 'FEEDBACK',
        GAME_OVER: 'GAME_OVER'
    };

    var COUNTDOWN_SECONDS = 3;
    var TOTAL_ROUNDS = 6;
    var STUDY_MS = 5200;
    var FEEDBACK_MS = 1100;
    var INTERFERENCE_PER_ROUND = 3;
    var BASE_POINTS = 120;

    var state = STATES.INIT;
    var level = 1;
    var round = 1;
    var score = 0;
    var lives = 3;
    var correctCount = 0;
    var wrongCount = 0;
    var sessionToken = null;
    var gameTimer = null;
    var currentBatch = null;
    var currentPrompt = null;
    var shownFacts = [];
    var interferenceIndex = 0;
    var interferenceHits = 0;
    var recallStartMs = 0;
    var streak = 0;
    var bestStreak = 0;
    var roundData = [];
    var timeouts = [];
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
        currentBatch = null;
        currentPrompt = null;
        shownFacts = [];
        interferenceIndex = 0;
        interferenceHits = 0;
        recallStartMs = 0;
        streak = 0;
        bestStreak = 0;
        roundData = [];
        if (gameTimer) gameTimer.reset();
    }

    function getBatchSize() {
        return Math.min(3 + Math.floor((level - 1) / 2), 6);
    }

    function renderFrame() {
        $board.empty().removeClass().addClass('game-board fact-loop-board');
        $board.html(
            '<div class="fl-shell">' +
                '<div class="fl-theme" id="fl-theme"></div>' +
                '<div class="fl-stage" id="fl-stage"></div>' +
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
        currentBatch = CerebroMemoryContent.getFactBatch(getBatchSize());
        shownFacts = currentBatch.cards.slice();
        currentPrompt = shownFacts[Math.floor(Math.random() * shownFacts.length)];
        interferenceIndex = 0;
        interferenceHits = 0;
        setStatus('Study the facts. Look for meaning, not just repetition.', 'watching');
        renderStudyPhase();
        state = STATES.STUDY;
        schedule(startInterferencePhase, Math.max(3200, STUDY_MS - (level - 1) * 250));
    }

    function renderStudyPhase() {
        $('#fl-theme').text('Theme: ' + currentBatch.theme);
        var html = '<div class="fl-study-grid">';
        shownFacts.forEach(function (card, index) {
            html += '<article class="fl-fact-card">';
            html += '<span class="fl-fact-index">Fact ' + (index + 1) + '</span>';
            html += '<h3>' + escapeHtml(card.answer) + '</h3>';
            html += '<p>' + escapeHtml(card.prompt) + '</p>';
            html += '</article>';
        });
        html += '</div>';
        $('#fl-stage').html(html);
        updateDisplay();
    }

    function startInterferencePhase() {
        state = STATES.INTERFERE;
        setStatus('Short interruption. Stay focused and classify fast.', 'your-turn');
        renderInterferenceTask();
    }

    function renderInterferenceTask() {
        var stimulus = CerebroMemoryContent.getInterferenceWord();
        $('#fl-stage').html(
            '<div class="fl-interference-wrap">' +
                '<span class="fl-phase-kicker">Interference Check ' + (interferenceIndex + 1) + ' / ' + INTERFERENCE_PER_ROUND + '</span>' +
                '<div class="fl-stimulus-card">' + escapeHtml(stimulus.word) + '</div>' +
                '<p class="fl-prompt">Does this word have 7 or more letters?</p>' +
                '<div class="fl-choice-row">' +
                    '<button class="fl-choice-btn" data-answer="yes" type="button">Yes</button>' +
                    '<button class="fl-choice-btn" data-answer="no" type="button">No</button>' +
                '</div>' +
            '</div>'
        );
        $('#fl-stage').data('expected', stimulus.isLong ? 'yes' : 'no');
    }

    function handleInterference(answer) {
        if (state !== STATES.INTERFERE) return;
        var expected = $('#fl-stage').data('expected');
        if (answer === expected) {
            interferenceHits++;
            if (window.CerebroSound) CerebroSound.tap();
        } else if (window.CerebroSound) {
            CerebroSound.wrong();
        }
        interferenceIndex++;
        if (interferenceIndex >= INTERFERENCE_PER_ROUND) {
            startRecallPhase();
        } else {
            renderInterferenceTask();
        }
    }

    function startRecallPhase() {
        state = STATES.RECALL;
        recallStartMs = gameTimer ? gameTimer.getElapsedMs() : 0;
        setStatus('Active recall: answer from memory.', 'your-turn');
        var choices = CerebroMemoryContent.getFactChoices(currentPrompt, Math.min(4, shownFacts.length + 1));
        var html = '<div class="fl-recall-card">';
        html += '<span class="fl-phase-kicker">Recall Prompt</span>';
        html += '<h3>' + escapeHtml(currentPrompt.prompt) + '</h3>';
        html += '<p>Pick the answer you studied a moment ago.</p>';
        html += '<div class="fl-choice-grid">';
        choices.forEach(function (choice) {
            html += '<button class="fl-answer-btn" data-choice="' + escapeHtml(choice) + '" type="button">' + escapeHtml(choice) + '</button>';
        });
        html += '</div></div>';
        $('#fl-stage').html(html);
    }

    function handleRecall(choice) {
        if (state !== STATES.RECALL) return;
        state = STATES.FEEDBACK;
        var reaction = gameTimer ? Math.max(0, gameTimer.getElapsedMs() - recallStartMs) : 0;
        var correct = choice === currentPrompt.answer;
        var roundScore = 0;

        if (correct) {
            correctCount++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            roundScore = BASE_POINTS + (level * 15) + (interferenceHits * 10) + Math.max(0, 60 - Math.floor(reaction / 40));
            score += roundScore;
            if (window.CerebroSound) CerebroSound.correct();
            setStatus('Correct. You pulled it back after interference.', 'correct');
        } else {
            wrongCount++;
            lives--;
            streak = 0;
            if (window.CerebroSound) CerebroSound.wrong();
            setStatus('Not quite. The answer was ' + currentPrompt.answer + '.', 'wrong');
        }

        roundData.push({
            prompt: currentPrompt.prompt,
            correct: correct,
            reaction_ms: reaction,
            score: roundScore
        });

        $('#fl-stage').html(
            '<div class="fl-feedback-card ' + (correct ? 'is-correct' : 'is-wrong') + '">' +
                '<span class="fl-phase-kicker">' + (correct ? 'Recovered' : 'Missed') + '</span>' +
                '<h3>' + escapeHtml(currentPrompt.answer) + '</h3>' +
                '<p>' + escapeHtml(currentPrompt.prompt) + '</p>' +
            '</div>'
        );

        updateDisplay();

        schedule(function () {
            round++;
            if (round > TOTAL_ROUNDS || lives <= 0) {
                endGame();
            } else {
                if (correct && round % 2 === 1) level++;
                if (!correct && level > 1 && wrongCount % 2 === 0) level--;
                startRound();
            }
        }, FEEDBACK_MS);
    }

    function endGame() {
        state = STATES.GAME_OVER;
        gameTimer.stop();
        var total = correctCount + wrongCount;
        var acc = total ? Math.round((correctCount / total) * 100) : 0;
        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + TOTAL_ROUNDS + ' correct');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(acc >= 80 ? 'Retention Locked In' : acc >= 60 ? 'Recall Improving' : 'Keep Building Recall');
        $('#result-badge').addClass('hidden');

        if (window.CerebroSound) CerebroSound.complete();
        if (window.CerebroApp && CerebroApp.animateScore) CerebroApp.animateScore(score);
        else $('#result-score').text(score);
        if (window.CerebroApp && CerebroApp.setTierBadge) CerebroApp.setTierBadge(score);
        if (window.CerebroApp && CerebroApp.updatePerformanceMeters) {
            CerebroApp.updatePerformanceMeters({
                accuracy: acc,
                reaction: averageReaction(),
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
                    return { sequence: [entry.prompt], input: [entry.correct ? 1 : 0], time_ms: entry.reaction_ms };
                }) },
                accuracy: acc
            };
            CerebroAPI.post('/game/end', payload).fail(function () {
                CerebroAPI.queueForRetry('POST', '/game/end', payload);
            });
        }
    }

    function averageReaction() {
        var values = roundData.filter(function (entry) { return entry.correct; }).map(function (entry) { return entry.reaction_ms; });
        if (!values.length) return 0;
        var total = values.reduce(function (sum, value) { return sum + value; }, 0);
        return Math.round(total / values.length);
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
        $(document).off('.factloop');
        $(document).on('click.factloop', '.fl-choice-btn', function () {
            handleInterference($(this).data('answer'));
        });
        $(document).on('click.factloop', '.fl-answer-btn', function () {
            handleRecall($(this).data('choice'));
        });
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        renderFrame();
        updateDisplay();
        $startScreen.addClass('hidden');
        CerebroAPI.post('/game/start', { game_slug: 'fact-loop' })
            .done(function (response) { sessionToken = response.token; })
            .fail(function () {});
        runCountdown();
    }

    function cleanup() {
        clearTimers();
        $(document).off('.factloop');
        if ($board) $board.empty().removeClass('fact-loop-board');
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
