# Provider Connection Routing Design

## Goal

Route each selected external model to the exact configured provider connection that supplied it.

## Root cause

Model discovery iterates each provider configuration, but chat requests contain only `ProviderType`. Every cloud connection has the same `OpenAICompatible` type, so provider selection chooses the first saved row: usually the default OpenAI configuration with no API key.

## Design

Add an optional `provider_config_id` to model records and selected model choices. Model discovery stamps each returned model with its source configuration ID. The frontend preserves that ID when a user selects a model and sends it with `chat_stream`. The backend resolves the chat provider by configuration ID, account ID, and type. Legacy choices without an ID retain the existing type-based fallback.

## Error handling

If a selected configuration no longer exists, belongs to another account, is disabled, or has a different type, reject the chat request with a clear configuration error. Do not fall back to another provider, because that can send requests to an unintended endpoint.

## Tests

Cover exact configuration lookup, source-ID stamping during model discovery, and model-choice ID uniqueness for same-name models from different connections.
