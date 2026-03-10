<?php
/**
 * Cerebro — Configuration
 * 
 * Database credentials, game constants, and CORS setup.
 * Copy this file to config.local.php and update credentials for your environment.
 */

// ── Database ─────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'cerebro');
define('DB_USER', 'root');
define('DB_PASS', 'root123');
define('DB_CHARSET', 'utf8mb4');

// ── Anti-Cheat Constants ─────────────────────────────────
define('MIN_REACTION_MS_PER_TILE', 100);   // Minimum humanly possible ms per tile
define('MAX_SCORE_MULTIPLIER', 5.0);       // Max theoretical score multiplier
define('RATE_LIMIT_WINDOW', 5);            // Seconds between score submissions
define('RATE_LIMIT_MAX', 1);               // Max submissions per window
define('SESSION_TOKEN_LENGTH', 64);        // Hex token length

// ── Game Defaults ────────────────────────────────────────
define('DEFAULT_GRID_SIZE', 3);
define('DEFAULT_SEQ_LENGTH', 3);
define('DEFAULT_FLASH_MS', 800);

// ── CORS ─────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Game-Token');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Error Reporting (disable in production) ──────────────
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
