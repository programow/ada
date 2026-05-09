use super::{SecretsError, Vault};
use std::collections::HashMap;
use std::sync::Mutex;
use zeroize::Zeroizing;

pub struct InMemoryVault {
    inner: Mutex<HashMap<String, String>>,
}

impl InMemoryVault {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for InMemoryVault {
    fn default() -> Self {
        Self::new()
    }
}

impl Vault for InMemoryVault {
    fn get(&self, provider_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError> {
        Ok(self
            .inner
            .lock()
            .unwrap()
            .get(provider_id)
            .map(|s| Zeroizing::new(s.clone())))
    }

    fn set(&self, provider_id: &str, key: &str) -> Result<(), SecretsError> {
        self.inner
            .lock()
            .unwrap()
            .insert(provider_id.into(), key.into());
        Ok(())
    }

    fn delete(&self, provider_id: &str) -> Result<(), SecretsError> {
        self.inner.lock().unwrap().remove(provider_id);
        Ok(())
    }

    fn list_configured(&self) -> Result<Vec<String>, SecretsError> {
        Ok(self.inner.lock().unwrap().keys().cloned().collect())
    }
}
