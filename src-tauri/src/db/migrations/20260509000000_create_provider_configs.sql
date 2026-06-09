CREATE TABLE IF NOT EXISTS provider_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL DEFAULT '',
    provider_type TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    ollama_host TEXT,
    ollama_api_key TEXT,
    ollama_api_base_url TEXT,
    api_key TEXT,
    api_base_url TEXT,
    preset TEXT,
    headers TEXT,
    model_suggestions TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_unique_connection
ON provider_configs (
    account_id,
    provider_type,
    COALESCE(ollama_host, ''),
    COALESCE(api_base_url, ''),
    COALESCE(preset, '')
);

INSERT OR IGNORE INTO provider_configs (account_id, provider_type, enabled, ollama_host, priority)
VALUES ('', 'OllamaLocal', 1, 'http://127.0.0.1:11434', 0);

INSERT OR IGNORE INTO provider_configs (account_id, provider_type, enabled, api_base_url, priority)
VALUES ('', 'OpenAICompatible', 0, 'https://api.openai.com/v1', 1);


