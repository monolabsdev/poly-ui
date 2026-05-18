-- Migration: Remove OllamaAPI provider type (no longer supported)
DELETE FROM provider_configs WHERE provider_type = 'OllamaAPI';
