<?php
/**
 * Cerebro — Logout
 *
 * POST /api/auth/logout
 */

require_once __DIR__ . '/../middleware.php';

requirePost();

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'] ?? false, $params['httponly'] ?? true);
}

session_destroy();

jsonResponse([
    'success' => true,
]);
