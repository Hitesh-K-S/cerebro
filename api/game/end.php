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

$body = getJsonBody();
requireFields($body, ['token', 'score', 'level_reached', 'duration_ms', 'replay']);

$token = sanitize($body['token']);
$claimedScore = sanitizeInt($body['score']);
$levelReached = sanitizeInt($body['level_reached']);
$durationMs = sanitizeInt($body['duration_ms']);
$replay = $body['replay'];

// ── Validate session token ──────────────────────────────
$session = validateSession($token);

// ── Rate limit check ────────────────────────────────────
$rateLimitKey = 'user:' . $session['user_id'];
if (!checkRateLimit($rateLimitKey, 'score_submit')) {
    jsonError('Too many submissions. Please wait.', 429);
}

// ── Anti-cheat: validate replay ─────────────────────────
$replayError = validateReplay($replay, $claimedScore, $durationMs);
if ($replayError !== null) {
    // Mark session as completed to prevent reuse
    completeSession($session['id']);
    jsonError('Anti-cheat validation failed: ' . $replayError, 403);
}

// ── Server-side score recalculation ─────────────────────
$calculatedScore = recalculateScore($replay);

// Allow small margin for floating-point differences
$scoreDiff = abs($calculatedScore - $claimedScore);
$maxAllowedDiff = max(10, $calculatedScore * 0.05); // 5% tolerance

if ($scoreDiff > $maxAllowedDiff) {
    completeSession($session['id']);
    jsonError('Score verification failed. Claimed: ' . $claimedScore . ', Calculated: ' . $calculatedScore, 403);
}

// Use the server-calculated score (trust no client data)
$finalScore = $calculatedScore;

// ── Save score ──────────────────────────────────────────
$scoreId = Database::insert(
    'INSERT INTO scores (user_id, game_id, session_id, score, level_reached, duration_ms, metadata) 
     VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
        $session['user_id'],
        $session['game_id'],
        $session['id'],
        $finalScore,
        $levelReached,
        $durationMs,
        json_encode($replay),
    ]
);

// ── Mark session as completed ───────────────────────────
completeSession($session['id']);

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
    'rank' => $rankRow['rank'],
    'personal_best' => $personalBest,
]);

// ── Helper: Recalculate score from replay ───────────────

function recalculateScore(array $replay): int
{
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

    return $totalScore;
}
