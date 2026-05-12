use super::{SecretsError, Vault, SERVICE_NAME};
use keyring::Entry;
use zeroize::Zeroizing;

pub struct KeyringVault;

impl KeyringVault {
    pub fn new() -> Self {
        Self
    }
}

impl Default for KeyringVault {
    fn default() -> Self {
        Self::new()
    }
}

impl Vault for KeyringVault {
    fn get(&self, secret_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError> {
        let entry = Entry::new(SERVICE_NAME, secret_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        match entry.get_password() {
            Ok(s) => Ok(Some(Zeroizing::new(s))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(SecretsError::BackendUnavailable(e.to_string())),
        }
    }

    fn set(&self, secret_id: &str, key: &str) -> Result<(), SecretsError> {
        let entry = Entry::new(SERVICE_NAME, secret_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        entry
            .set_password(key)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))
    }

    fn delete(&self, secret_id: &str) -> Result<(), SecretsError> {
        let entry = Entry::new(SERVICE_NAME, secret_id)
            .map_err(|e| SecretsError::BackendUnavailable(e.to_string()))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(SecretsError::BackendUnavailable(e.to_string())),
        }
    }
}
