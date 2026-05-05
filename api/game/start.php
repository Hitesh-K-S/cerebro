<?php
/**
 * Cerebro — Start Game Session
 * 
 * POST /api/game/start
 * Body: { "game_slug": "pattern-recall" }
 * 
 * Creates a game session token for anti-cheat validation.
 */

require_once __DIR__ . '/../middleware.php';

requirePost();

$body = getJsonBody();
requireFields($body, ['game_slug']);

$gameSlug = sanitize($body['game_slug']);
$user = requireAuthenticatedUser();
$userId = (int) $user['id'];

// ── Validate game exists ────────────────────────────────
$game = Database::fetchOne(
    'SELECT id, slug, name, category FROM games WHERE slug = ? AND is_active = 1',
    [$gameSlug]
);

if (!$game) {
    jsonError('Game not found or inactive.', 404);
}

// ── Invalidate any existing uncompleted sessions ────────
Database::query(
    'UPDATE game_sessions SET completed = 1, completed_at = NOW() 
     WHERE user_id = ? AND game_id = ? AND completed = 0',
    [$userId, $game['id']]
);

// ── Create new session ──────────────────────────────────
$token = generateSessionToken();

$sessionId = Database::insert(
    'INSERT INTO game_sessions (user_id, game_id, token) VALUES (?, ?, ?)',
    [$userId, $game['id'], $token]
);

// ── Build game config based on user's history ───────────
// Start at level 1 by default; could be adaptive based on history
$config = [
    'grid' => DEFAULT_GRID_SIZE,
    'seq_length' => DEFAULT_SEQ_LENGTH,
    'flash_ms' => DEFAULT_FLASH_MS,
];

jsonResponse([
    'success' => true,
    'token' => $token,
    'session_id' => (int) $sessionId,
    'game' => [
        'id' => $game['id'],
        'slug' => $game['slug'],
        'name' => $game['name'],
        'category' => $game['category'],
    ],
    'config' => $config,
]);
