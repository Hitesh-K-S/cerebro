<?php
/**
 * Cerebro — Session State
 *
 * GET /api/auth/session
 */

require_once __DIR__ . '/../middleware.php';

$user = getAuthenticatedUser();

jsonResponse([
    'success' => true,
    'authenticated' => $user !== null,
    'google_configured' => GOOGLE_CLIENT_ID !== '',
    'google_client_id' => GOOGLE_CLIENT_ID !== '' ? GOOGLE_CLIENT_ID : null,
    'user' => $user,
]);
