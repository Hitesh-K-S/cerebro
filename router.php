<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$filePath = __DIR__ . $uri;

if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    return false;
}

$phpFile = $filePath . '.php';
if ($uri !== '/' && file_exists($phpFile)) {
    require $phpFile;
    return true;
}

$indexFile = __DIR__ . '/index.html';
if (file_exists($indexFile)) {
    require $indexFile;
    return true;
}

http_response_code(404);
echo '404 Not Found';
