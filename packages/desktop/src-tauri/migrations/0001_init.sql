CREATE TABLE transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    text TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    deleted_at INTEGER NULL
);
CREATE INDEX idx_transcriptions_created_at ON transcriptions(created_at);
CREATE INDEX idx_transcriptions_provider ON transcriptions(provider_id);
