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
    "SELECT s.id, s.score, s.level_reached, s.duration_ms, s.accuracy, s.created_at,
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
$summaryParams = array_slice($params, 0, count($params) - 1);
$summary = Database::fetchOne(
    "SELECT COUNT(*) as total_sessions,
            MAX(s.score) as best_score,
            AVG(s.score) as avg_score,
            AVG(s.accuracy) as avg_accuracy,
            COALESCE(SUM(s.duration_ms), 0) as total_time_ms,
            MAX(s.created_at) as last_played_at
     FROM scores s
     JOIN games g ON g.id = s.game_id
     WHERE {$whereClause}",
    $summaryParams
);

$categories = [];
$games = [];
$recentSessions = [];

if (empty($gameSlug)) {
    $categories = Database::fetchAll(
        "SELECT g.category,
                COUNT(*) as sessions,
                AVG(s.accuracy) as avg_accuracy,
                MAX(s.score) as best_score
         FROM scores s
         JOIN games g ON g.id = s.game_id
         WHERE s.user_id = ?
         GROUP BY g.category
         ORDER BY sessions DESC, g.category ASC",
        [$userId]
    );

    $games = Database::fetchAll(
        "SELECT g.slug, g.name, g.category,
                COUNT(*) as sessions,
                MAX(s.score) as best_score,
                AVG(s.accuracy) as avg_accuracy,
                AVG(s.duration_ms) as avg_duration_ms,
                MAX(s.created_at) as last_played_at
         FROM scores s
         JOIN games g ON g.id = s.game_id
         WHERE s.user_id = ?
         GROUP BY g.id, g.slug, g.name, g.category
         ORDER BY best_score DESC, sessions DESC, g.name ASC",
        [$userId]
    );

    $recentSessions = Database::fetchAll(
        "SELECT s.id, s.score, s.level_reached, s.duration_ms, s.accuracy, s.created_at,
                g.slug as game_slug, g.name as game_name, g.category
         FROM scores s
         JOIN games g ON g.id = s.game_id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC
         LIMIT 12",
        [$userId]
    );
}

jsonResponse([
    'success' => true,
    'user_id' => $userId,
    'scores' => $scores,
    'stats' => [
        'best_score' => (int) ($stats['best_score'] ?? 0),
        'total_games' => (int) ($stats['total_games'] ?? 0),
        'avg_score' => (int) round($stats['avg_score'] ?? 0),
        'total_sessions' => (int) ($summary['total_sessions'] ?? 0),
        'avg_accuracy' => round((float) ($summary['avg_accuracy'] ?? 0), 2),
        'total_time_ms' => (int) ($summary['total_time_ms'] ?? 0),
        'last_played_at' => $summary['last_played_at'] ?? null,
    ],
    'categories' => $categories,
    'games' => $games,
    'recent_sessions' => $recentSessions,
]);
