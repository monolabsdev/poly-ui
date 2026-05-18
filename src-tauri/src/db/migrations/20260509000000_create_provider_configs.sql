-- Migration: Create provider_configs table
CREATE TABLE IF NOT EXISTS provider_configs (
    provider_type TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    ollama_host TEXT,
    ollama_api_key TEXT,
    ollama_api_base_url TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default Ollama Local config
INSERT OR IGNORE INTO provider_configs (provider_type, enabled, ollama_host, priority)
VALUES ('OllamaLocal', 1, 'http://127.0.0.1:11434', 0);

-- Force update localhost to 127.0.0.1 for reliability on Windows if it hasn't been customized
UPDATE provider_configs 
SET ollama_host = 'http://127.0.0.1:11434' 
WHERE provider_type = 'OllamaLocal' AND ollama_host = 'http://localhost:11434';


