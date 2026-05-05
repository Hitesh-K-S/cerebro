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
        'SELECT id, username, email, display_name, avatar_url, auth_provider
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
function validateSession(string $token): array
{
    if (strlen($token) !== SESSION_TOKEN_LENGTH) {
        jsonError('Invalid session token format.', 401);
    }

    $session = Database::fetchOne(
        'SELECT gs.*, g.slug as game_slug 
         FROM game_sessions gs 
         JOIN games g ON g.id = gs.game_id 
         WHERE gs.token = ? AND gs.completed = 0',
        [$token]
    );

    if (!$session) {
        jsonError('Invalid or expired session token.', 401);
    }

    return $session;
}

/**
 * Mark a session as completed.
 */
function completeSession(int $sessionId): void
{
    Database::query(
        'UPDATE game_sessions SET completed = 1, completed_at = NOW() WHERE id = ?',
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

    $totalTiles = 0;
    foreach ($replay['rounds'] as $round) {
        if (!isset($round['sequence'], $round['input'], $round['time_ms'])) {
            return 'Incomplete round data in replay.';
        }

        // Verify the input matches the sequence
        if ($round['sequence'] !== $round['input']) {
            // Last round can be a failed attempt
            if ($round !== end($replay['rounds'])) {
                return 'Replay sequence mismatch in non-final round.';
            }
        }

        $totalTiles += count($round['sequence']);

        // Check timing plausibility
        $minTimeForRound = count($round['sequence']) * MIN_REACTION_MS_PER_TILE;
        if ($round['time_ms'] < $minTimeForRound) {
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
