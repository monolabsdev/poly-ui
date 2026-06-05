use crate::providers::base::{LLMProvider, ProviderConfig, ProviderStatus, ProviderType};
use crate::providers::factory::ProviderFactory;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex as TokioMutex;

#[derive(Clone)]
struct HealthCache {
    status: ProviderStatus,
    last_check: Instant,
}

fn health_cache_ttl(status: ProviderStatus) -> Duration {
    match status {
        ProviderStatus::Online => Duration::from_secs(10),
        ProviderStatus::Offline | ProviderStatus::Reconnecting | ProviderStatus::Unavailable => {
            Duration::from_secs(1)
        }
    }
}

pub struct ProviderSelector {
    pool: SqlitePool,
    health_cache: Arc<TokioMutex<HashMap<i64, HealthCache>>>,
    active_provider: Arc<TokioMutex<Option<ProviderType>>>,
}

impl ProviderSelector {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            health_cache: Arc::new(TokioMutex::new(HashMap::new())),
            active_provider: Arc::new(TokioMutex::new(None)),
        }
    }

    pub async fn get_provider_configs(&self) -> Result<Vec<ProviderConfig>, String> {
        let mut conn = self.pool.acquire().await.map_err(|e| e.to_string())?;

        let configs = sqlx::query_as::<_, ProviderConfig>(
            "SELECT id, provider_type, enabled, ollama_host, ollama_api_key, ollama_api_base_url, api_key, api_base_url, priority, preset, headers, model_suggestions FROM provider_configs ORDER BY priority ASC"
        )
        .fetch_all(&mut *conn)
        .await
        .map_err(|e| e.to_string())?;

        Ok(configs)
    }

    pub async fn check_all_providers(&self) -> HashMap<i64, ProviderStatus> {
        let configs = match self.get_provider_configs().await {
            Ok(c) => c,
            Err(_) => return HashMap::new(),
        };

        let mut results = HashMap::new();
        let now = Instant::now();

        let mut futures = Vec::new();

        {
            let cache = self.health_cache.lock().await;
            for config in configs {
                let config_id = config.id.unwrap_or(0);

                if !config.enabled {
                    results.insert(config_id, ProviderStatus::Unavailable);
                    continue;
                }

                if let Some(cached) = cache.get(&config_id) {
                    if cached.last_check.elapsed() < health_cache_ttl(cached.status) {
                        results.insert(config_id, cached.status);
                        continue;
                    }
                }

                let provider_opt = ProviderFactory::create(config.clone());
                futures.push(async move {
                    let status = if let Some(provider) = provider_opt {
                        tokio::time::timeout(Duration::from_secs(10), provider.health_check())
                            .await
                            .unwrap_or(ProviderStatus::Offline)
                    } else {
                        ProviderStatus::Unavailable
                    };
                    (config_id, status)
                });
            }
        }

        if !futures.is_empty() {
            let checked = futures::future::join_all(futures).await;
            let mut cache = self.health_cache.lock().await;
            for (config_id, status) in checked {
                cache.insert(
                    config_id,
                    HealthCache {
                        status,
                        last_check: now,
                    },
                );
                results.insert(config_id, status);
            }
        }

        results
    }

    pub async fn get_active_provider(&self) -> Result<Box<dyn LLMProvider>, String> {
        let configs = self.get_provider_configs().await?;
        let health = self.check_all_providers().await;

        for config in configs {
            if !config.enabled {
                continue;
            }
            let config_id = config.id.unwrap_or(0);
            if !matches!(
                health.get(&config_id),
                Some(ProviderStatus::Online)
            ) {
                continue;
            }
            if let Some(provider) = ProviderFactory::create(config.clone()) {
                let mut active = self.active_provider.lock().await;
                *active = Some(config.provider_type);
                return Ok(provider);
            }
        }

        Err("No available LLM providers found. Please check your settings.".to_string())
    }

    pub async fn get_provider(
        &self,
        provider_type: ProviderType,
    ) -> Result<Box<dyn LLMProvider>, String> {
        let config = self
            .get_provider_configs()
            .await?
            .into_iter()
            .find(|config| config.provider_type == provider_type)
            .ok_or_else(|| format!("{provider_type:?} provider is not configured."))?;

        ProviderFactory::create(config)
            .ok_or_else(|| format!("{provider_type:?} provider is disabled."))
    }

    pub async fn get_active_provider_type(&self) -> Option<ProviderType> {
        *self.active_provider.lock().await
    }

    /// Bypass the health check cache and re-check every provider.
    pub async fn force_check_all_providers(&self) -> HashMap<i64, ProviderStatus> {
        self.health_cache.lock().await.clear();
        self.check_all_providers().await
    }

    pub async fn update_provider_config(
        &self,
        config_id: Option<i64>,
        provider_type: &ProviderType,
        enabled: bool,
        ollama_host: Option<String>,
        ollama_api_key: Option<String>,
        ollama_api_base_url: Option<String>,
        api_key: Option<String>,
        api_base_url: Option<String>,
        preset: Option<String>,
        headers: Option<String>,
        model_suggestions: Option<String>,
    ) -> Result<(), String> {
        let mut conn = self.pool.acquire().await.map_err(|e| e.to_string())?;

        if let Some(id) = config_id {
            sqlx::query(
                r#"
                UPDATE provider_configs SET
                    enabled = ?1,
                    ollama_host = ?2,
                    ollama_api_key = ?3,
                    ollama_api_base_url = ?4,
                    api_key = ?5,
                    api_base_url = ?6,
                    preset = ?7,
                    headers = ?8,
                    model_suggestions = ?9,
                    updated_at = datetime('now')
                WHERE id = ?10
                "#,
            )
            .bind(enabled)
            .bind(&ollama_host)
            .bind(&ollama_api_key)
            .bind(&ollama_api_base_url)
            .bind(&api_key)
            .bind(&api_base_url)
            .bind(&preset)
            .bind(&headers)
            .bind(&model_suggestions)
            .bind(id)
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        } else {
            // Fallback: update by provider_type (legacy path)
            sqlx::query(
                r#"
                UPDATE provider_configs SET
                    enabled = ?1,
                    ollama_host = ?2,
                    ollama_api_key = ?3,
                    ollama_api_base_url = ?4,
                    api_key = ?5,
                    api_base_url = ?6,
                    preset = ?7,
                    headers = ?8,
                    model_suggestions = ?9,
                    updated_at = datetime('now')
                WHERE provider_type = ?10
                "#,
            )
            .bind(enabled)
            .bind(&ollama_host)
            .bind(&ollama_api_key)
            .bind(&ollama_api_base_url)
            .bind(&api_key)
            .bind(&api_base_url)
            .bind(&preset)
            .bind(&headers)
            .bind(&model_suggestions)
            .bind(provider_type)
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        }

        self.health_cache.lock().await.clear();
        Ok(())
    }

    pub async fn add_provider_config(
        &self,
        provider_type: &ProviderType,
        enabled: bool,
        ollama_host: Option<String>,
        api_key: Option<String>,
        api_base_url: Option<String>,
        preset: Option<String>,
        headers: Option<String>,
        model_suggestions: Option<String>,
    ) -> Result<i64, String> {
        let mut conn = self.pool.acquire().await.map_err(|e| e.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO provider_configs (provider_type, enabled, ollama_host, api_key, api_base_url, preset, headers, model_suggestions, priority, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, (SELECT COALESCE(MAX(priority), 0) + 1 FROM provider_configs), datetime('now'), datetime('now'))
            "#,
        )
        .bind(provider_type)
        .bind(enabled)
        .bind(&ollama_host)
        .bind(&api_key)
        .bind(&api_base_url)
        .bind(&preset)
        .bind(&headers)
        .bind(&model_suggestions)
        .execute(&mut *conn)
        .await
        .map_err(|e| e.to_string())?;

        let id: (i64,) = sqlx::query_as("SELECT last_insert_rowid()")
            .fetch_one(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;

        self.health_cache.lock().await.clear();
        Ok(id.0)
    }

    pub async fn delete_provider_config(&self, config_id: i64) -> Result<(), String> {
        let mut conn = self.pool.acquire().await.map_err(|e| e.to_string())?;

        sqlx::query("DELETE FROM provider_configs WHERE id = ?1")
            .bind(config_id)
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;

        self.health_cache.lock().await.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_provider_cache_expires_quickly() {
        assert_eq!(
            health_cache_ttl(ProviderStatus::Offline),
            Duration::from_secs(1)
        );
        assert_eq!(
            health_cache_ttl(ProviderStatus::Unavailable),
            Duration::from_secs(1)
        );
    }

    #[test]
    fn online_provider_cache_limits_background_work() {
        assert_eq!(
            health_cache_ttl(ProviderStatus::Online),
            Duration::from_secs(10)
        );
        assert_eq!(
            health_cache_ttl(ProviderStatus::Reconnecting),
            Duration::from_secs(1)
        );
    }
}
