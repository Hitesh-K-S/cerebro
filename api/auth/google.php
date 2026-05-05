<?php
/**
 * Cerebro — Google Sign-In
 *
 * POST /api/auth/google
 * Body: { "credential": "<google_id_token>" }
 */

require_once __DIR__ . '/../middleware.php';

requirePost();

if (GOOGLE_CLIENT_ID === '') {
    jsonError('Google authentication is not configured.', 503);
}

$body = getJsonBody();
requireFields($body, ['credential']);

$googleUser = verifyGoogleCredential((string) $body['credential']);
$existingUser = Database::fetchOne(
    'SELECT id, username FROM users WHERE google_sub = ? OR email = ? LIMIT 1',
    [$googleUser['sub'], $googleUser['email']]
);

$displayName = buildDisplayName($googleUser);
$username = $existingUser['username'] ?? generateUniqueUsername($displayName, $googleUser['email']);

if ($existingUser) {
    Database::query(
        'UPDATE users
         SET username = ?, email = ?, display_name = ?, avatar_url = ?, auth_provider = ?, google_sub = ?, updated_at = NOW()
         WHERE id = ?',
        [
            $username,
            $googleUser['email'],
            $displayName,
            $googleUser['picture'],
            'google',
            $googleUser['sub'],
            $existingUser['id'],
        ]
    );
    $userId = (int) $existingUser['id'];
} else {
    $userId = (int) Database::insert(
        'INSERT INTO users (username, email, password_hash, auth_provider, google_sub, display_name, avatar_url)
         VALUES (?, ?, NULL, ?, ?, ?, ?)',
        [
            $username,
            $googleUser['email'],
            'google',
            $googleUser['sub'],
            $displayName,
            $googleUser['picture'],
        ]
    );
}

$_SESSION['user_id'] = $userId;

$user = Database::fetchOne(
    'SELECT id, username, email, display_name, avatar_url, auth_provider
     FROM users
     WHERE id = ?',
    [$userId]
);

jsonResponse([
    'success' => true,
    'user' => $user,
]);

function verifyGoogleCredential(string $credential): array
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential);
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        jsonError('Could not verify Google credential.', 502);
    }

    $payload = json_decode($response, true);
    if (!is_array($payload)) {
        jsonError('Invalid response from Google verification.', 502);
    }

    if (($payload['aud'] ?? '') !== GOOGLE_CLIENT_ID) {
        jsonError('Google credential audience mismatch.', 401);
    }

    if (($payload['email_verified'] ?? '') !== 'true') {
        jsonError('Google email is not verified.', 401);
    }

    if (empty($payload['sub']) || empty($payload['email'])) {
        jsonError('Incomplete Google account data.', 401);
    }

    return [
        'sub' => (string) $payload['sub'],
        'email' => (string) $payload['email'],
        'name' => (string) ($payload['name'] ?? ''),
        'given_name' => (string) ($payload['given_name'] ?? ''),
        'picture' => (string) ($payload['picture'] ?? ''),
    ];
}

function buildDisplayName(array $googleUser): string
{
    $displayName = trim($googleUser['name'] ?: $googleUser['given_name']);
    if ($displayName !== '') {
        return $displayName;
    }

    return strtok($googleUser['email'], '@') ?: 'Cerebro User';
}

function generateUniqueUsername(string $displayName, string $email): string
{
    $base = preg_replace('/[^a-z0-9]+/i', '', strtolower($displayName));
    if ($base === '') {
        $base = preg_replace('/[^a-z0-9]+/i', '', strtolower((string) strtok($email, '@')));
    }

    $base = substr($base ?: 'cerebro', 0, 24);
    $candidate = $base;
    $suffix = 1;

    while (Database::fetchOne('SELECT id FROM users WHERE username = ? LIMIT 1', [$candidate])) {
        $candidate = substr($base, 0, 20) . $suffix;
        $suffix++;
    }

    return $candidate;
}
