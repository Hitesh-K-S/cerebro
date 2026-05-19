<?php
/**
 * Cerebro — Update Profile
 *
 * POST /api/auth/update-profile
 * Body: { "username": "newusername" }
 */

require_once __DIR__ . '/../middleware.php';

requirePost();

$user = requireAuthenticatedUser();

$body = getJsonBody();
requireFields($body, ['username']);

$username = trim($body['username']);

// ── Validate username ────────────────────────────────────
if (strlen($username) < 3 || strlen($username) > 24) {
    jsonError('Username must be between 3 and 24 characters.', 400);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    jsonError('Username can only contain letters, numbers, and underscores.', 400);
}

// ── Check uniqueness ─────────────────────────────────────
$existing = Database::fetchOne(
    'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
    [$username, $user['id']]
);

if ($existing) {
    jsonError('Username is already taken.', 409);
}

// ── Update ───────────────────────────────────────────────
Database::query(
    'UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?',
    [$username, $user['id']]
);

$updatedUser = Database::fetchOne(
    'SELECT id, username, email, display_name, avatar_url, auth_provider, created_at FROM users WHERE id = ?',
    [$user['id']]
);

jsonResponse([
    'success' => true,
    'user' => $updatedUser,
]);
