<?php
/**
 * Cerebro — Middleware Helpers
 * 
 * Authentication, validation, rate limiting, and response utilities.
 */

require_once __DIR__ . '/db.php';

// ── Response Helpers ─────────────────────────────────────

/**
 * Send a JSON response and terminate.
 */
function jsonResponse(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send an error response.
 */
function jsonError(string $message, int $code = 400): void
{
    jsonResponse(['success' => false, 'error' => $message], $code);
}

// ── Request Validation ───────────────────────────────────

/**
 * Require POST method or die.
 */
function requirePost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Method not allowed. Use POST.', 405);
    }
}

/**
 * Get the decoded JSON body from the request.
 */
function getJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        jsonError('Invalid JSON body.', 400);
    }

    return $data;
}

/**
 * Require specific keys in the input data.
 */
function requireFields(array $data, array $fields): void
{
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            $missing[] = $field;
        }
    }

    if (!empty($missing)) {
        jsonError('Missing required fields: ' . implode(', ', $missing), 400);
    }
}

// ── Sanitization ─────────────────────────────────────────

/**
 * Sanitize a string input.
 */
function sanitize(string $input): string
{
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

/**
 * Sanitize and cast to positive integer.
 */
function sanitizeInt($input): int
{
    return max(0, (int) $input);
}

// ── Authentication ───────────────────────────────────────

/**
 * Return the authenticated user from the current PHP session.
 */
function getAuthenticatedUser(): ?array
{
    $userId = sanitizeInt($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        return null;
    }

    return Database::fetchOne(
        'SELECT id, username, email, display_name, avatar_url, auth_provider, created_at
         FROM users
         WHERE id = ?',
        [$userId]
    );
}

/**
 * Require an authenticated user or return 401.
 */
function requireAuthenticatedUser(): array
{
    $user = getAuthenticatedUser();
    if (!$user) {
        jsonError('Authentication required.', 401);
    }

    return $user;
}

// ── Session Token Validation ─────────────────────────────

/**
 * Generate a cryptographically secure game session token.
 */
function generateSessionToken(): string
{
    return bin2hex(random_bytes(SESSION_TOKEN_LENGTH / 2));
}

/**
 * Validate a game session token.
 * Returns the session row or sends an error response.
 */
function findSessionByToken(string $token): ?array
{
    if (strlen($token) !== SESSION_TOKEN_LENGTH) {
        jsonError('Invalid session token format.', 401);
    }

    return Database::fetchOne(
        'SELECT gs.*, g.slug as game_slug 
         FROM game_sessions gs 
         JOIN games g ON g.id = gs.game_id 
         WHERE gs.token = ?',
        [$token]
    );
}

function validateSession(string $token, ?int $userId = null): array
{
    $session = findSessionByToken($token);

    if (!$session) {
        jsonError('Invalid or expired session token.', 401);
    }

    if ($userId !== null && (int) $session['user_id'] !== $userId) {
        jsonError('This session does not belong to the authenticated user.', 403);
    }

    if ((int) $session['completed'] === 1) {
        jsonError('This session is already closed.', 409);
    }

    return $session;
}

/**
 * Mark a session as completed.
 */
function completeSession(int $sessionId, string $reason = 'completed'): void
{
    Database::query(
        'UPDATE game_sessions
         SET completed = 1,
             ended_reason = ?,
             completed_at = NOW(),
             last_activity_at = NOW()
         WHERE id = ?',
        [$reason, $sessionId]
    );
}

function touchSession(int $sessionId): void
{
    Database::query(
        'UPDATE game_sessions SET last_activity_at = NOW() WHERE id = ?',
        [$sessionId]
    );
}

// ── Rate Limiting ────────────────────────────────────────

/**
 * Check rate limit for an identifier + action combo.
 * Returns true if the action is allowed.
 */
function checkRateLimit(string $identifier, string $action): bool
{
    // Clean up old entries (older than the window)
    Database::query(
        'DELETE FROM rate_limits WHERE identifier = ? AND action = ? AND attempted_at < DATE_SUB(NOW(), INTERVAL ? SECOND)',
        [$identifier, $action, RATE_LIMIT_WINDOW]
    );

    // Count recent attempts
    $row = Database::fetchOne(
        'SELECT COUNT(*) as cnt FROM rate_limits WHERE identifier = ? AND action = ? AND attempted_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)',
        [$identifier, $action, RATE_LIMIT_WINDOW]
    );

    if ($row && $row['cnt'] >= RATE_LIMIT_MAX) {
        return false;
    }

    // Record this attempt
    Database::insert(
        'INSERT INTO rate_limits (identifier, action) VALUES (?, ?)',
        [$identifier, $action]
    );

    return true;
}

/**
 * Get client IP address (handles proxies).
 */
function getClientIp(): string
{
    $headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ips = explode(',', $_SERVER[$header]);
            return trim($ips[0]);
        }
    }
    return '0.0.0.0';
}

// ── Anti-Cheat Validation ────────────────────────────────

/**
 * Validate replay data for anti-cheat purposes.
 * Returns an error string or null if valid.
 */
function validateReplay(array $replay, int $claimedScore, int $durationMs): ?string
{
    if (!isset($replay['rounds']) || !is_array($replay['rounds'])) {
        return 'Missing or invalid replay rounds.';
    }

    if (count($replay['rounds']) === 0) {
        return 'Replay is empty.';
    }

    $totalTiles = 0;
    foreach ($replay['rounds'] as $round) {
        if (!is_array($round) || !isset($round['time_ms'])) {
            return 'Incomplete round data in replay.';
        }

        if (isset($round['sequence']) && !is_array($round['sequence'])) {
            return 'Replay sequence format is invalid.';
        }

        if (isset($round['input']) && !is_array($round['input'])) {
            return 'Replay input format is invalid.';
        }

        $sequence = isset($round['sequence']) ? $round['sequence'] : [];
        $input = isset($round['input']) ? $round['input'] : [];
        $interactionSize = max(count($sequence), count($input), 1);

        $totalTiles += $interactionSize;

        // Check timing plausibility
        $minTimeForRound = $interactionSize * MIN_REACTION_MS_PER_TILE;
        if ($round['time_ms'] > 0 && $round['time_ms'] < $minTimeForRound) {
            return 'Implausibly fast reaction time detected.';
        }
    }

    // Check total duration plausibility
    $minTotalTime = $totalTiles * MIN_REACTION_MS_PER_TILE;
    if ($durationMs < $minTotalTime) {
        return 'Total game duration is implausibly short.';
    }

    return null; // Valid
}
