<?php
/**
 * Cerebro — Leaderboard
 * 
 * GET /api/scores/leaderboard?game=pattern-recall&limit=10
 * 
 * Returns top scores for a game.
 */

require_once __DIR__ . '/../middleware.php';

$gameSlug = sanitize($_GET['game'] ?? '');
$limit = min(50, max(1, sanitizeInt($_GET['limit'] ?? 10)));

if (empty($gameSlug)) {
    jsonError('Missing "game" parameter.', 400);
}

// ── Fetch top scores ────────────────────────────────────
$scores = Database::fetchAll(
    'SELECT s.score, s.level_reached, s.duration_ms, s.created_at,
            u.username, u.id as user_id
     FROM scores s
     JOIN users u ON u.id = s.user_id
     JOIN games g ON g.id = s.game_id
     WHERE g.slug = ?
     ORDER BY s.score DESC
     LIMIT ?',
    [$gameSlug, $limit]
);

// Add rank numbers
$ranked = array_map(function ($row, $index) {
    $row['rank'] = $index + 1;
    return $row;
}, $scores, array_keys($scores));

jsonResponse([
    'success' => true,
    'game' => $gameSlug,
    'scores' => $ranked,
    'total' => count($ranked),
]);
