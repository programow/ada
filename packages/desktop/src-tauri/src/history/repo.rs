use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Transcription {
    pub id: i64,
    pub created_at: i64,
    pub text: String,
    pub duration_ms: i64,
    pub word_count: i64,
    pub provider_id: String,
    pub model_id: String,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTranscription {
    pub created_at: i64,
    pub text: String,
    pub duration_ms: i64,
    pub word_count: i64,
    pub provider_id: String,
    pub model_id: String,
}

pub async fn insert(pool: &SqlitePool, t: &NewTranscription) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        "INSERT INTO transcriptions (created_at, text, duration_ms, word_count, provider_id, model_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(t.created_at)
    .bind(&t.text)
    .bind(t.duration_ms)
    .bind(t.word_count)
    .bind(&t.provider_id)
    .bind(&t.model_id)
    .fetch_one(pool)
    .await?;
    Ok(row.get::<i64, _>("id"))
}

pub async fn list(
    pool: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<Vec<Transcription>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, created_at, text, duration_ms, word_count, provider_id, model_id, deleted_at FROM transcriptions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    let out = rows
        .iter()
        .map(|r| Transcription {
            id: r.get("id"),
            created_at: r.get("created_at"),
            text: r.get("text"),
            duration_ms: r.get("duration_ms"),
            word_count: r.get("word_count"),
            provider_id: r.get("provider_id"),
            model_id: r.get("model_id"),
            deleted_at: r.get("deleted_at"),
        })
        .collect();
    Ok(out)
}

pub async fn soft_delete(pool: &SqlitePool, id: i64, now: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE transcriptions SET deleted_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn purge_all(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let res = sqlx::query("DELETE FROM transcriptions")
        .execute(pool)
        .await?;
    Ok(res.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    pub(crate) async fn setup_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        let migration = include_str!("../../migrations/0001_init.sql");
        for stmt in migration.split(';') {
            let trimmed = stmt.trim();
            if trimmed.is_empty() {
                continue;
            }
            sqlx::query(trimmed).execute(&pool).await.unwrap();
        }
        pool
    }

    #[tokio::test]
    async fn insert_then_list_returns_row() {
        let pool = setup_pool().await;
        let id = insert(
            &pool,
            &NewTranscription {
                created_at: 1000,
                text: "hello".into(),
                duration_ms: 500,
                word_count: 1,
                provider_id: "openai".into(),
                model_id: "whisper-1".into(),
            },
        )
        .await
        .unwrap();
        assert!(id > 0);
        let rows = list(&pool, 10, 0).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].text, "hello");
    }

    #[tokio::test]
    async fn soft_delete_hides_from_list() {
        let pool = setup_pool().await;
        let id = insert(
            &pool,
            &NewTranscription {
                created_at: 1000,
                text: "x".into(),
                duration_ms: 1,
                word_count: 1,
                provider_id: "openai".into(),
                model_id: "whisper-1".into(),
            },
        )
        .await
        .unwrap();
        soft_delete(&pool, id, 2000).await.unwrap();
        let rows = list(&pool, 10, 0).await.unwrap();
        assert_eq!(rows.len(), 0);
    }
}
