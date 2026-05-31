ALTER TABLE provider_configs ADD COLUMN api_key TEXT;
ALTER TABLE provider_configs ADD COLUMN api_base_url TEXT;

INSERT OR IGNORE INTO provider_configs (provider_type, enabled, api_base_url, priority)
VALUES ('OpenAICompatible', 0, 'https://api.openai.com/v1', 1);
