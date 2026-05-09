use sqlx::sqlite::SqlitePool;

/// Soft-delete rows older than `cutoff_ms` and hard-delete rows that have been
/// soft-deleted for more than 30 days.
pub async fn purge(
    pool: &SqlitePool,
    now_ms: i64,
    retention_days: i64,
) -> Result<(u64, u64), sqlx::Error> {
    let soft_cutoff = now_ms - retention_days * 24 * 60 * 60 * 1000;
    let hard_cutoff = now_ms - 30 * 24 * 60 * 60 * 1000;
    let soft = sqlx::query(
        "UPDATE transcriptions SET deleted_at = ? WHERE deleted_at IS NULL AND created_at < ?",
    )
    .bind(now_ms)
    .bind(soft_cutoff)
    .execute(pool)
    .await?
    .rows_affected();
    let hard = sqlx::query(
        "DELETE FROM transcriptions WHERE deleted_at IS NOT NULL AND deleted_at < ?",
    )
    .bind(hard_cutoff)
    .execute(pool)
    .await?
    .rows_affected();
    Ok((soft, hard))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::history::repo::{insert, list, NewTranscription};
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_pool() -> SqlitePool {
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
    async fn rows_older_than_window_are_soft_deleted() {
        let pool = setup_pool().await;
        let one_year_ms = 365i64 * 24 * 60 * 60 * 1000;
        let now_ms = one_year_ms + 1000;
        insert(
            &pool,
            &NewTranscription {
                created_at: 0,
                text: "old".into(),
                duration_ms: 100,
                word_count: 1,
                provider_id: "openai".into(),
                model_id: "whisper-1".into(),
            },
        )
        .await
        .unwrap();
        insert(
            &pool,
            &NewTranscription {
                created_at: now_ms - 1000,
                text: "new".into(),
                duration_ms: 100,
                word_count: 1,
                provider_id: "openai".into(),
                model_id: "whisper-1".into(),
            },
        )
        .await
        .unwrap();
        let (soft, _hard) = purge(&pool, now_ms, 365).await.unwrap();
        assert_eq!(soft, 1);
        let rows = list(&pool, 100, 0).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].text, "new");
    }
}
