-- ============================================================
-- Cerebro — Brain Training Platform
-- Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS cerebro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cerebro;

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
CREATE TABLE users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    auth_provider VARCHAR(32)  NOT NULL DEFAULT 'google',
    google_sub    VARCHAR(255) NULL UNIQUE,
    display_name  VARCHAR(255) NULL,
    avatar_url    TEXT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_google_sub (google_sub)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Games Registry
-- ------------------------------------------------------------
CREATE TABLE games (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug        VARCHAR(64)  NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    description TEXT,
    category    ENUM('memory','attention','reaction','logic','speed') NOT NULL,
    is_active   TINYINT(1)   DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_slug (slug),
    INDEX idx_category (category)
) ENGINE=InnoDB;

-- Seed the game catalog
INSERT INTO games (slug, name, description, category) VALUES
('pattern-recall', 'Pattern Recall', 'Memorize and replay a sequence of flashing tiles.', 'memory'),
('digit-juggler', 'Digit Juggler', 'Hold shifting number patterns in working memory.', 'memory'),
('signal-hunter', 'Signal Hunter', 'Track fast visual cues and react to priority targets.', 'attention'),
('rapid-sort', 'Rapid Sort', 'Classify shifting inputs under time pressure.', 'speed'),
('impulse-guard', 'Impulse Guard', 'Suppress fast wrong answers and choose the correct response.', 'attention'),
('mirror-maze', 'Mirror Maze', 'Mentally rotate mirrored paths to find the right route.', 'logic'),
('word-grid', 'Word Grid', 'Memorize word positions and identify what appeared.', 'memory'),
('flanker-task', 'Flanker Task', 'Respond to the center target while ignoring surrounding distractors.', 'attention'),
('syllogisms', 'Syllogisms', 'Evaluate whether conclusions follow from formal premises.', 'logic'),
('rule-shifter', 'Rule Shifter', 'Adapt when the active decision rule changes mid-run.', 'attention'),
('fact-loop', 'Fact Loop', 'Encode short facts, survive interference, and retrieve them accurately.', 'memory'),
('memory-chain', 'Memory Chain', 'Link related steps together and rebuild them in order.', 'memory'),
('review-rhythm', 'Review Rhythm', 'Revisit items at spaced intervals to strengthen retention.', 'memory'),
('sequence-recall', 'Sequence Recall', 'Watch a sequence and reconstruct the exact order from memory.', 'memory'),
('chunking-game', 'Chunking Game', 'Compress information into meaningful groups for stronger recall.', 'memory'),
('mental-stack', 'Mental Stack', 'Track layered state changes and predict the final system state.', 'logic'),
('attention-control', 'Attention Control', 'Respond only to exact target matches and ignore distractors.', 'attention');

-- ------------------------------------------------------------
-- Game Sessions (anti-cheat tokens)
-- ------------------------------------------------------------
CREATE TABLE game_sessions (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED    NOT NULL,
    game_id     INT UNSIGNED    NOT NULL,
    token       CHAR(64)        NOT NULL UNIQUE,
    started_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed   TINYINT(1)      DEFAULT 0,
    ended_reason ENUM('completed','replaced','rejected','abandoned') NULL,
    completed_at TIMESTAMP      NULL,

    INDEX idx_token (token),
    INDEX idx_user_game (user_id, game_id),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Scores
-- ------------------------------------------------------------
CREATE TABLE scores (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED    NOT NULL,
    game_id       INT UNSIGNED    NOT NULL,
    session_id    BIGINT UNSIGNED NOT NULL,
    score         INT UNSIGNED    NOT NULL DEFAULT 0,
    level_reached SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    duration_ms   INT UNSIGNED    NOT NULL DEFAULT 0,
    accuracy      DECIMAL(5,2)    NOT NULL DEFAULT 0,
    metadata      JSON            NULL,      -- replay data, round details, etc.
    created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_game_score (user_id, game_id, score DESC),
    INDEX idx_game_score (game_id, score DESC),
    INDEX idx_created (created_at),

    FOREIGN KEY (user_id)    REFERENCES users(id)          ON DELETE CASCADE,
    FOREIGN KEY (game_id)    REFERENCES games(id)          ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Rate Limiting (simple table-based)
-- ------------------------------------------------------------
CREATE TABLE rate_limits (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    identifier  VARCHAR(128) NOT NULL,   -- "ip:action" or "user:action"
    action      VARCHAR(64)  NOT NULL,
    attempted_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_identifier_action (identifier, action, attempted_at)
) ENGINE=InnoDB;
