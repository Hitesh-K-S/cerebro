ALTER TABLE users
    MODIFY password_hash VARCHAR(255) NULL,
    ADD COLUMN auth_provider VARCHAR(32) NOT NULL DEFAULT 'google' AFTER password_hash,
    ADD COLUMN google_sub VARCHAR(255) NULL UNIQUE AFTER auth_provider,
    ADD COLUMN display_name VARCHAR(255) NULL AFTER google_sub,
    ADD COLUMN avatar_url TEXT NULL AFTER display_name;
