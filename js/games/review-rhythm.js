/**
 * Cerebro — Review Rhythm Game Engine
 */

'use strict';

var ReviewRhythm = (function ($) {

    var STATES = {
        INIT: 'INIT',
        COUNTDOWN: 'COUNTDOWN',
        STUDY: 'STUDY',
        REVIEW: 'REVIEW',
        FEEDBACK: 'FEEDBACK',
        GAME_OVER: 'GAME_OVER'
    };

    var COUNTDOWN_SECONDS = 3;
    var TOTAL_ROUNDS = 12;
    var STUDY_MS = 2800;
    var FEEDBACK_MS = 900;

    var state = STATES.INIT;
    var level = 1;
    var round = 1;
    var score = 0;
    var lives = 3;
    var correctCount = 0;
    var wrongCount = 0;
    var sessionToken = null;
    var gameTimer = null;
    var reviewDeck = [];
    var currentEntry = null;
    var showingNewCard = false;
    var reviewStreak = 0;
    var bestStreak = 0;
    var roundData = [];
    var timeouts = [];
    var recallStartMs = 0;
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
        reviewDeck = [];
        currentEntry = null;
        showingNewCard = false;
        reviewStreak = 0;
        bestStreak = 0;
        roundData = [];
        recallStartMs = 0;
        if (gameTimer) gameTimer.reset();
    }

    function renderFrame() {
        $board.empty().removeClass().addClass('game-board review-rhythm-board');
        $board.html(
            '<div class="rr-shell">' +
                '<div class="rr-header">' +
                    '<div class="rr-meter"><span>New</span><strong id="rr-new-count">0</strong></div>' +
                    '<div class="rr-meter"><span>Due</span><strong id="rr-due-count">0</strong></div>' +
                    '<div class="rr-meter"><span>Mastered</span><strong id="rr-mastered-count">0</strong></div>' +
                '</div>' +
                '<div class="rr-stage" id="rr-stage"></div>' +
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
                advanceRound();
            }
        }, 1000);
    }

    function advanceRound() {
        currentEntry = chooseEntryForRound();
        if (!currentEntry) {
            endGame();
            return;
        }

        showingNewCard = currentEntry.state === 'new';
        if (showingNewCard) {
            state = STATES.STUDY;
            setStatus('New item. Encode it clearly before it returns.', 'watching');
            renderStudyCard();
            schedule(beginReviewPrompt, Math.max(1800, STUDY_MS - (level - 1) * 100));
        } else {
            beginReviewPrompt();
        }

        updateDisplay();
        updateMeters();
    }

    function chooseEntryForRound() {
        var due = reviewDeck.filter(function (entry) { return entry.state !== 'mastered' && entry.dueRound <= round; });
        if (due.length) {
            return CerebroMemoryContent.shuffle(due).sort(function (a, b) { return a.dueRound - b.dueRound; })[0];
        }

        var needNew = reviewDeck.length < 6;
        if (needNew) {
            var batch = CerebroMemoryContent.getFactBatch(1);
            var card = batch.cards[0];
            var entry = {
                prompt: card.prompt,
                answer: card.answer,
                theme: batch.theme,
                state: 'new',
                dueRound: round,
                successes: 0
            };
            reviewDeck.push(entry);
            return entry;
        }

        return reviewDeck.filter(function (entry) { return entry.state !== 'mastered'; })[0] || null;
    }

    function renderStudyCard() {
        $('#rr-stage').html(
            '<div class="rr-study-card">' +
                '<span class="rr-chip">New • ' + escapeHtml(currentEntry.theme) + '</span>' +
                '<h3>' + escapeHtml(currentEntry.answer) + '</h3>' +
                '<p>' + escapeHtml(currentEntry.prompt) + '</p>' +
            '</div>'
        );
    }

    function beginReviewPrompt() {
        state = STATES.REVIEW;
        recallStartMs = gameTimer ? gameTimer.getElapsedMs() : 0;
        setStatus(showingNewCard ? 'Immediate check. Pull it back once.' : 'Review item due now. Retrieve before you guess.', 'your-turn');
        currentEntry.state = currentEntry.successes > 0 ? 'review' : 'learning';
        var choices = CerebroMemoryContent.getFactChoices(currentEntry, 4);
        var html = '<div class="rr-review-card">';
        html += '<span class="rr-chip">' + (showingNewCard ? 'First recall' : 'Spaced review') + '</span>';
        html += '<h3>' + escapeHtml(currentEntry.prompt) + '</h3>';
        html += '<div class="rr-choice-grid">';
        choices.forEach(function (choice) {
            html += '<button class="rr-choice-btn" data-choice="' + escapeHtml(choice) + '" type="button">' + escapeHtml(choice) + '</button>';
        });
        html += '</div></div>';
        $('#rr-stage').html(html);
    }

    function answerReview(choice) {
        if (state !== STATES.REVIEW) return;
        state = STATES.FEEDBACK;
        var correct = choice === currentEntry.answer;
        var reaction = gameTimer ? Math.max(0, gameTimer.getElapsedMs() - recallStartMs) : 0;
        var points = 0;

        if (correct) {
            correctCount++;
            reviewStreak++;
            bestStreak = Math.max(bestStreak, reviewStreak);
            currentEntry.successes++;
            if (currentEntry.successes >= 3) {
                currentEntry.state = 'mastered';
                currentEntry.dueRound = Number.MAX_SAFE_INTEGER;
                points = 220 + (level * 20);
            } else {
                currentEntry.state = 'review';
                currentEntry.dueRound = round + currentEntry.successes + 1;
                points = 120 + (currentEntry.successes * 40) + Math.max(0, 50 - Math.floor(reaction / 50));
            }
            score += points;
            if (window.CerebroSound) CerebroSound.correct();
            if (correctCount % 3 === 0) level++;
        } else {
            wrongCount++;
            lives--;
            reviewStreak = 0;
            currentEntry.successes = 0;
            currentEntry.state = 'review';
            currentEntry.dueRound = round + 1;
            if (wrongCount % 2 === 0 && level > 1) level--;
            if (window.CerebroSound) CerebroSound.wrong();
        }

        roundData.push({
            prompt: currentEntry.prompt,
            correct: correct,
            reaction_ms: reaction,
            score: points,
            state: currentEntry.state
        });

        setStatus(correct ? 'Stored. It will come back later if needed.' : 'Missed. It will return sooner for another pass.', correct ? 'correct' : 'wrong');
        $('#rr-stage').html(
            '<div class="rr-feedback-card ' + (correct ? 'is-correct' : 'is-wrong') + '">' +
                '<span class="rr-chip">' + escapeHtml(currentEntry.theme) + '</span>' +
                '<h3>' + escapeHtml(currentEntry.answer) + '</h3>' +
                '<p>' + escapeHtml(currentEntry.prompt) + '</p>' +
            '</div>'
        );

        updateDisplay();
        updateMeters();

        schedule(function () {
            round++;
            if (round > TOTAL_ROUNDS || lives <= 0 || allMastered()) endGame();
            else advanceRound();
        }, FEEDBACK_MS);
    }

    function allMastered() {
        return reviewDeck.length >= 4 && reviewDeck.every(function (entry) { return entry.state === 'mastered'; });
    }

    function updateMeters() {
        var newCount = reviewDeck.filter(function (entry) { return entry.state === 'new'; }).length;
        var dueCount = reviewDeck.filter(function (entry) { return entry.state !== 'mastered' && entry.dueRound <= round; }).length;
        var masteredCount = reviewDeck.filter(function (entry) { return entry.state === 'mastered'; }).length;
        $('#rr-new-count').text(newCount);
        $('#rr-due-count').text(dueCount);
        $('#rr-mastered-count').text(masteredCount);
    }

    function endGame() {
        state = STATES.GAME_OVER;
        gameTimer.stop();
        var total = correctCount + wrongCount;
        var acc = total ? Math.round((correctCount / total) * 100) : 0;
        $('#result-level').text(level);
        $('#result-rounds').text(correctCount + '/' + total + ' reviews');
        $('#result-time').text(gameTimer.getFormatted());
        $('#result-accuracy').text(acc + '%');
        $('#modal-title').text(masteredCount() >= 4 ? 'Retention Building Momentum' : acc >= 70 ? 'Review Rhythm Improving' : 'Keep Reviewing');
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

    function masteredCount() {
        return reviewDeck.filter(function (entry) { return entry.state === 'mastered'; }).length;
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
        $(document).off('.reviewrhythm');
        $(document).on('click.reviewrhythm', '.rr-choice-btn', function () {
            answerReview($(this).data('choice'));
        });
    }

    function startGame() {
        resetGame();
        gameTimer = CerebroTimer.create();
        gameTimer.reset().start();
        renderFrame();
        updateDisplay();
        updateMeters();
        $startScreen.addClass('hidden');
        CerebroAPI.post('/game/start', { game_slug: 'review-rhythm' })
            .done(function (response) { sessionToken = response.token; })
            .fail(function () {});
        runCountdown();
    }

    function cleanup() {
        clearTimers();
        $(document).off('.reviewrhythm');
        if ($board) $board.empty().removeClass('review-rhythm-board');
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
