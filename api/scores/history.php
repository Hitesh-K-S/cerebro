<?php
/**
 * Cerebro — Score History
 * 
 * GET /api/scores/history?game=pattern-recall&limit=20
 * 
 * Returns the authenticated user's score history for a game.
 */

require_once __DIR__ . '/../middleware.php';

$user = requireAuthenticatedUser();
$userId = (int) $user['id'];
$gameSlug = sanitize($_GET['game'] ?? '');
$limit = min(100, max(1, sanitizeInt($_GET['limit'] ?? 20)));

// ── Build query ─────────────────────────────────────────
$params = [$userId];
$whereClause = 's.user_id = ?';

if (!empty($gameSlug)) {
    $whereClause .= ' AND g.slug = ?';
    $params[] = $gameSlug;
}

$params[] = $limit;

$scores = Database::fetchAll(
    "SELECT s.id, s.score, s.level_reached, s.duration_ms, s.created_at,
            g.slug as game_slug, g.name as game_name
     FROM scores s
     JOIN games g ON g.id = s.game_id
     WHERE {$whereClause}
     ORDER BY s.created_at DESC
     LIMIT ?",
    $params
);

// ── Get personal best ───────────────────────────────────
$bestQuery = "SELECT MAX(s.score) as best_score, COUNT(*) as total_games,
                     AVG(s.score) as avg_score
              FROM scores s
              JOIN games g ON g.id = s.game_id
              WHERE s.user_id = ?";
$bestParams = [$userId];

if (!empty($gameSlug)) {
    $bestQuery .= ' AND g.slug = ?';
    $bestParams[] = $gameSlug;
}

$stats = Database::fetchOne($bestQuery, $bestParams);

jsonResponse([
    'success' => true,
    'user_id' => $userId,
    'scores' => $scores,
    'stats' => [
        'best_score' => (int) ($stats['best_score'] ?? 0),
        'total_games' => (int) ($stats['total_games'] ?? 0),
        'avg_score' => (int) round($stats['avg_score'] ?? 0),
    ],
]);
