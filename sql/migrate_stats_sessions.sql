ALTER TABLE game_sessions
    ADD COLUMN last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER started_at,
    ADD COLUMN ended_reason ENUM('completed','replaced','rejected','abandoned') NULL AFTER completed;

ALTER TABLE scores
    ADD COLUMN accuracy DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER duration_ms;

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
('attention-control', 'Attention Control', 'Respond only to exact target matches and ignore distractors.', 'attention')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    is_active = 1;
