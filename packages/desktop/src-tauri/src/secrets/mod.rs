use zeroize::Zeroizing;

pub mod keyring_vault;
#[cfg(test)]
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

/// Cross-platform credential store. The first parameter is opaque — callers
/// pass any stable string (now an api_key UUID) and the trait simply uses it
/// as the keychain account name.
pub trait Vault: Send + Sync {
    fn get(&self, secret_id: &str) -> Result<Option<Zeroizing<String>>, SecretsError>;
    fn set(&self, secret_id: &str, key: &str) -> Result<(), SecretsError>;
    fn delete(&self, secret_id: &str) -> Result<(), SecretsError>;
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
    fn debug_format_redacts_value() {
        let key = SecretKey::from("sk-real-key-123");
        let formatted = format!("{:?}", key);
        assert!(!formatted.contains("sk-real-key-123"));
        assert!(formatted.contains("redacted"));
    }
}
