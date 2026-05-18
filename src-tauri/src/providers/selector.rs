use crate::providers::base::{LLMProvider, ProviderConfig, ProviderStatus, ProviderType};
use crate::providers::factory::ProviderFactory;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sqlx::SqlitePool;
use tokio::sync::Mutex as TokioMutex;

#[derive(Clone)]
struct HealthCache {
    status: ProviderStatus,
    last_check: Instant,
}

pub struct ProviderSelector {
    pool: SqlitePool,
    health_cache: Arc<TokioMutex<HashMap<ProviderType, HealthCache>>>,
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
        let mut conn = self.pool.acquire().await.map_err(|e| {
            e.to_string()
        })?;

        let configs = sqlx::query_as::<_, ProviderConfig>(
            "SELECT provider_type, enabled, ollama_host, ollama_api_key, ollama_api_base_url, priority FROM provider_configs ORDER BY priority ASC"
        )
        .fetch_all(&mut *conn)
        .await
        .map_err(|e| e.to_string())?;

        Ok(configs)
    }

    pub async fn check_all_providers(&self) -> HashMap<ProviderType, ProviderStatus> {
        let configs = match self.get_provider_configs().await {
            Ok(c) => c,
            Err(_) => return HashMap::new(),
        };

        let mut results = HashMap::new();
        let now = Instant::now();
        
        // We collect futures to run in parallel
        let mut futures = Vec::new();
        
        {
            let cache = self.health_cache.lock().await;
            for config in configs {
                if !config.enabled {
                    results.insert(config.provider_type, ProviderStatus::Unavailable);
                    continue;
                }

                if let Some(cached) = cache.get(&config.provider_type) {
                    if cached.last_check.elapsed() < Duration::from_secs(30) {
                        results.insert(config.provider_type, cached.status);
                        continue;
                    }
                }

                // If not in cache or expired, add to futures
                let provider_opt = ProviderFactory::create(config.clone());
                let p_type = config.provider_type;
                futures.push(async move {
                    let status = if let Some(provider) = provider_opt {
                        provider.health_check().await
                    } else {
                        ProviderStatus::Unavailable
                    };
                    (p_type, status)
                });
            }
        }

        // Run checks in parallel with a global timeout
        if !futures.is_empty() {
            let check_task = futures::future::join_all(futures);
            let results_with_timeout = tokio::time::timeout(std::time::Duration::from_secs(10), check_task).await;
            
            if let Ok(p_results) = results_with_timeout {
                let mut cache = self.health_cache.lock().await;
                for (p_type, status) in p_results {
                    cache.insert(p_type, HealthCache {
                        status,
                        last_check: now,
                    });
                    results.insert(p_type, status);
                }
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

            if let Some(status) = health.get(&config.provider_type) {
                if *status == ProviderStatus::Online {
                    if let Some(provider) = ProviderFactory::create(config.clone()) {
                        let mut active = self.active_provider.lock().await;
                        *active = Some(config.provider_type);
                        return Ok(provider);
                    }
                }
            }
        }

        Err("No available LLM providers found. Please check your settings.".to_string())
    }

    pub async fn get_active_provider_type(&self) -> Option<ProviderType> {
        *self.active_provider.lock().await
    }

    /// Bypass the 30-second health check cache and re-check every provider.
    pub async fn force_check_all_providers(&self) -> HashMap<ProviderType, ProviderStatus> {
        self.health_cache.lock().await.clear();
        self.check_all_providers().await
    }
}
