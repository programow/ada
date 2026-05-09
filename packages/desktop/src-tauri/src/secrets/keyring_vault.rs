use super::{SecretsError, Vault, SERVICE_NAME};
use keyring::Entry;
use std::sync::Mutex;
use zeroize::Zeroizing;

pub struct KeyringVault {
    /// Tracks provider IDs we know we've stored, so list_configured() works.
    /// (The Secret Service API doesn't expose enumeration of credentials by
    /// service name in a portable way; we keep an in-memory index plus a
    /// JSON file so the list survives restarts.)
    known_ids: Mutex<Vec<String>>,
}

impl KeyringVault {
    pub fn new(known_ids: Vec<String>) -> Self {
        Self {
            known_ids: Mutex::new(known_ids),
        }
    }
}

impl Vault for KeyringVault {
    fn get(&self, provider_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError> {
        let entry = Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        match entry.get_password() {
            Ok(s) => Ok(Some(Zeroizing::new(s))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(SecretsError::BackendUnavailable(e.to_string())),
        }
    }

    fn set(&self, provider_id: &str, key: &str) -> Result<(), SecretsError> {
        let entry = Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        entry
            .set_password(key)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        let mut ids = self.known_ids.lock().unwrap();
        if !ids.iter().any(|s| s == provider_id) {
            ids.push(provider_id.into());
        }
        Ok(())
    }

    fn delete(&self, provider_id: &str) -> Result<(), SecretsError> {
        let entry = Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(SecretsError::BackendUnavailable(e.to_string())),
        }
        self.known_ids.lock().unwrap().retain(|s| s != provider_id);
        Ok(())
    }

    fn list_configured(&self) -> Result<Vec<String>, SecretsError> {
        Ok(self.known_ids.lock().unwrap().clone())
    }
}
