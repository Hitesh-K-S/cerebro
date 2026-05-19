<?php
/**
 * Cerebro — End Game Session & Save Score
 * 
 * POST /api/game/end
 * Body: {
 *   "token": "abc123...",
 *   "score": 2450,
 *   "level_reached": 5,
 *   "duration_ms": 45320,
 *   "replay": {
 *     "rounds": [
 *       { "sequence": [2,5,7], "input": [2,5,7], "time_ms": 3200 },
 *       ...
 *     ]
 *   }
 * }
 * 
 * Validates replay data, applies anti-cheat checks, saves score.
 */

require_once __DIR__ . '/../middleware.php';

requirePost();

$user = requireAuthenticatedUser();
$userId = (int) $user['id'];

$body = getJsonBody();
requireFields($body, ['token', 'score', 'level_reached', 'duration_ms', 'replay']);

$token = sanitize($body['token']);
$claimedScore = sanitizeInt($body['score']);
$levelReached = sanitizeInt($body['level_reached']);
$durationMs = sanitizeInt($body['duration_ms']);
$replay = $body['replay'];

// ── Validate session token ──────────────────────────────
$existingSession = findSessionByToken($token);
if (!$existingSession) {
    jsonError('Invalid or expired session token.', 401);
}

if ((int) $existingSession['user_id'] !== $userId) {
    jsonError('This session does not belong to the authenticated user.', 403);
}

if ((int) $existingSession['completed'] === 1) {
    $existingScore = Database::fetchOne(
        'SELECT id, score, accuracy FROM scores WHERE session_id = ? LIMIT 1',
        [$existingSession['id']]
    );

    if ($existingScore) {
        $rankRow = Database::fetchOne(
            'SELECT COUNT(*) + 1 as rank FROM scores WHERE game_id = ? AND score > ?',
            [$existingSession['game_id'], $existingScore['score']]
        );

        jsonResponse([
            'success' => true,
            'score_id' => (int) $existingScore['id'],
            'final_score' => (int) $existingScore['score'],
            'accuracy' => (float) $existingScore['accuracy'],
            'rank' => (int) ($rankRow['rank'] ?? 1),
            'personal_best' => false,
            'already_recorded' => true,
        ]);
    }

    jsonError('This session is already closed.', 409);
}

$session = validateSession($token, $userId);
touchSession((int) $session['id']);

// ── Rate limit check ────────────────────────────────────
$rateLimitKey = 'user:' . $session['user_id'];
if (!checkRateLimit($rateLimitKey, 'score_submit')) {
    jsonError('Too many submissions. Please wait.', 429);
}

// ── Anti-cheat: validate replay ─────────────────────────
$replayError = validateReplay($replay, $claimedScore, $durationMs);
if ($replayError !== null) {
    completeSession((int) $session['id'], 'rejected');
    jsonError('Anti-cheat validation failed: ' . $replayError, 403);
}

// ── Server-side score recalculation ─────────────────────
$scoreVerification = recalculateScore($session['game_slug'], $replay, $claimedScore);
$finalScore = $scoreVerification['score'];

if ($scoreVerification['verified']) {
    $scoreDiff = abs($finalScore - $claimedScore);
    $maxAllowedDiff = max(10, $finalScore * 0.05);
    if ($scoreDiff > $maxAllowedDiff) {
        completeSession((int) $session['id'], 'rejected');
        jsonError('Score verification failed. Claimed: ' . $claimedScore . ', Calculated: ' . $finalScore, 403);
    }
}

// ── Calculate accuracy ───────────────────────────────────
$accuracy = calculateAccuracy($body, $replay);
$metadata = buildScoreMetadata($session['game_slug'], $claimedScore, $finalScore, $replay, $accuracy);

// ── Save score ──────────────────────────────────────────
$scoreId = Database::insert(
    'INSERT INTO scores (user_id, game_id, session_id, score, level_reached, duration_ms, accuracy, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
        $session['user_id'],
        $session['game_id'],
        $session['id'],
        $finalScore,
        $levelReached,
        $durationMs,
        $accuracy,
        json_encode($metadata),
    ]
);

// ── Mark session as completed ───────────────────────────
completeSession((int) $session['id'], 'completed');

// ── Calculate rank ──────────────────────────────────────
$rankRow = Database::fetchOne(
    'SELECT COUNT(*) + 1 as rank FROM scores WHERE game_id = ? AND score > ?',
    [$session['game_id'], $finalScore]
);

// ── Check personal best ─────────────────────────────────
$bestRow = Database::fetchOne(
    'SELECT MAX(score) as best FROM scores WHERE user_id = ? AND game_id = ? AND id != ?',
    [$session['user_id'], $session['game_id'], $scoreId]
);

$personalBest = !$bestRow['best'] || $finalScore > $bestRow['best'];

jsonResponse([
    'success' => true,
    'score_id' => (int) $scoreId,
    'final_score' => $finalScore,
    'accuracy' => $accuracy,
    'rank' => $rankRow['rank'],
    'personal_best' => $personalBest,
]);

// ── Helper: Recalculate score from replay ───────────────

function recalculateScore(string $gameSlug, array $replay, int $claimedScore): array
{
    if ($gameSlug !== 'pattern-recall') {
        return [
            'score' => max(0, $claimedScore),
            'verified' => false,
        ];
    }

    $basePoints = 100;
    $totalScore = 0;

    foreach ($replay['rounds'] as $index => $round) {
        $level = $index + 1;
        $seqLength = count($round['sequence']);
        $difficultyMultiplier = 1.0 + ($level * 0.15);

        // Time bonus: faster = higher bonus, capped at 0.5 minimum
        $maxAllowedMs = max(5000, 10000 - ($level * 1000));
        $timeBonus = max(0.5, 1.0 - ($round['time_ms'] / $maxAllowedMs));

        // Only count if sequence matches input (successful round)
        if ($round['sequence'] === $round['input']) {
            $roundScore = $basePoints * $seqLength * $difficultyMultiplier * $timeBonus;
            $totalScore += (int) round($roundScore);
        }
    }

    return [
        'score' => $totalScore,
        'verified' => true,
    ];
}

function calculateAccuracy(array $body, array $replay): float
{
    if (isset($body['accuracy'])) {
        return max(0, min(100, round((float) $body['accuracy'], 2)));
    }

    $totalRounds = count($replay['rounds']);
    if ($totalRounds === 0) {
        return 0;
    }

    $successfulRounds = 0;
    foreach ($replay['rounds'] as $round) {
        if (roundWasSuccessful($round)) {
            $successfulRounds++;
        }
    }

    return round(($successfulRounds / $totalRounds) * 100, 2);
}

function roundWasSuccessful(array $round): bool
{
    if (array_key_exists('correct', $round)) {
        return (bool) $round['correct'];
    }

    if (isset($round['input']) && is_array($round['input']) && count($round['input']) === 1) {
        return $round['input'][0] === 1 || $round['input'][0] === '1' || $round['input'][0] === true;
    }

    if (isset($round['sequence'], $round['input']) && is_array($round['sequence']) && is_array($round['input'])) {
        return $round['sequence'] === $round['input'];
    }

    return false;
}

function buildScoreMetadata(string $gameSlug, int $claimedScore, int $finalScore, array $replay, float $accuracy): array
{
    return [
        'game_slug' => $gameSlug,
        'client_score' => $claimedScore,
        'server_score' => $finalScore,
        'accuracy' => $accuracy,
        'replay' => $replay,
    ];
}
