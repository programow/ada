use zeroize::Zeroizing;

pub mod keyring_vault;
pub mod mock;

pub const SERVICE_NAME: &str = "vox-era";

#[derive(Debug, thiserror::Error)]
pub enum SecretsError {
    #[error("no key set for provider")]
    NotFound,
    #[error("keychain backend unavailable: {0}")]
    BackendUnavailable(String),
    #[error("unexpected: {0}")]
    Other(String),
}

pub trait Vault: Send + Sync {
    fn get(&self, provider_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError>;
    fn set(&self, provider_id: &str, key: &str) -> Result<(), SecretsError>;
    fn delete(&self, provider_id: &str) -> Result<(), SecretsError>;
    fn list_configured(&self) -> Result<Vec<String>, SecretsError>;
}

#[derive(Clone)]
pub struct SecretKey(Zeroizing<String>);

impl SecretKey {
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl From<&str> for SecretKey {
    fn from(s: &str) -> Self {
        Self(Zeroizing::new(s.to_string()))
    }
}

impl From<String> for SecretKey {
    fn from(s: String) -> Self {
        Self(Zeroizing::new(s))
    }
}

impl std::fmt::Debug for SecretKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SecretKey(redacted)")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mock::InMemoryVault;

    #[test]
    fn set_then_get_returns_the_key() {
        let v = InMemoryVault::new();
        v.set("openai", "sk-test-123").unwrap();
        let got = v.get("openai").unwrap().unwrap();
        assert_eq!(&*got, "sk-test-123");
    }

    #[test]
    fn get_missing_returns_none() {
        let v = InMemoryVault::new();
        assert!(v.get("openai").unwrap().is_none());
    }

    #[test]
    fn delete_removes_the_key() {
        let v = InMemoryVault::new();
        v.set("openai", "sk-x").unwrap();
        v.delete("openai").unwrap();
        assert!(v.get("openai").unwrap().is_none());
    }

    #[test]
    fn list_configured_returns_all_provider_ids() {
        let v = InMemoryVault::new();
        v.set("openai", "sk-1").unwrap();
        v.set("groq", "gsk-1").unwrap();
        let mut ids = v.list_configured().unwrap();
        ids.sort();
        assert_eq!(ids, vec!["groq".to_string(), "openai".to_string()]);
    }

    #[test]
    fn debug_format_redacts_value() {
        let key = SecretKey::from("sk-real-key-123");
        let formatted = format!("{:?}", key);
        assert!(!formatted.contains("sk-real-key-123"));
        assert!(formatted.contains("redacted"));
    }
}
