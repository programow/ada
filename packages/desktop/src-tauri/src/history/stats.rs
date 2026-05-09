use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    pub total_words: i64,
    pub words_this_week: i64,
    pub words_this_month: i64,
    pub average_wpm: f64,
    pub time_saved_minutes: f64,
    pub top_provider: Option<String>,
    pub top_model: Option<(String, String)>,
    pub streak_days: i64,
}

pub async fn total_words(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        "SELECT COALESCE(SUM(word_count), 0) AS total FROM transcriptions WHERE deleted_at IS NULL",
    )
    .fetch_one(pool)
    .await?;
    Ok(row.get::<i64, _>("total"))
}

pub async fn words_since(pool: &SqlitePool, since: i64) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        "SELECT COALESCE(SUM(word_count), 0) AS total FROM transcriptions WHERE deleted_at IS NULL AND created_at >= ?",
    )
    .bind(since)
    .fetch_one(pool)
    .await?;
    Ok(row.get::<i64, _>("total"))
}

pub async fn average_wpm(pool: &SqlitePool) -> Result<f64, sqlx::Error> {
    let row = sqlx::query(
        "SELECT COALESCE(AVG(word_count * 60000.0 / duration_ms), 0.0) AS wpm FROM transcriptions WHERE deleted_at IS NULL AND duration_ms > 0",
    )
    .fetch_one(pool)
    .await?;
    Ok(row.get::<f64, _>("wpm"))
}

pub async fn time_saved_minutes(pool: &SqlitePool) -> Result<f64, sqlx::Error> {
    let row = sqlx::query(
        "SELECT COALESCE(SUM(word_count) / 45.0 - SUM(duration_ms) / 60000.0, 0.0) AS saved FROM transcriptions WHERE deleted_at IS NULL",
    )
    .fetch_one(pool)
    .await?;
    Ok(row.get::<f64, _>("saved"))
}

pub async fn top_provider(pool: &SqlitePool) -> Result<Option<String>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT provider_id FROM transcriptions WHERE deleted_at IS NULL GROUP BY provider_id ORDER BY COUNT(*) DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.get::<String, _>("provider_id")))
}

pub async fn top_model(pool: &SqlitePool) -> Result<Option<(String, String)>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT provider_id, model_id FROM transcriptions WHERE deleted_at IS NULL GROUP BY provider_id, model_id ORDER BY COUNT(*) DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| (r.get("provider_id"), r.get("model_id"))))
}

pub async fn streak_days(
    pool: &SqlitePool,
    today_unix_secs: i64,
) -> Result<i64, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT DISTINCT date(created_at/1000, 'unixepoch') AS day FROM transcriptions WHERE deleted_at IS NULL ORDER BY day DESC",
    )
    .fetch_all(pool)
    .await?;
    let mut streak = 0i64;
    let mut expected = chrono::DateTime::from_timestamp(today_unix_secs, 0)
        .unwrap()
        .date_naive();
    for row in rows {
        let day_str: String = row.get("day");
        let day = chrono::NaiveDate::parse_from_str(&day_str, "%Y-%m-%d").unwrap();
        if day == expected {
            streak += 1;
            expected = expected.pred_opt().unwrap();
        } else if day < expected {
            break;
        }
    }
    Ok(streak)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::history::repo::{insert, NewTranscription};
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

    async fn add(
        pool: &SqlitePool,
        created_at_ms: i64,
        words: i64,
        duration_ms: i64,
        p: &str,
        m: &str,
    ) {
        insert(
            pool,
            &NewTranscription {
                created_at: created_at_ms,
                text: "x".into(),
                duration_ms,
                word_count: words,
                provider_id: p.into(),
                model_id: m.into(),
            },
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn total_words_sums_word_count() {
        let pool = setup_pool().await;
        add(&pool, 1000, 5, 1000, "openai", "whisper-1").await;
        add(&pool, 2000, 10, 2000, "groq", "whisper-large-v3").await;
        assert_eq!(total_words(&pool).await.unwrap(), 15);
    }

    #[tokio::test]
    async fn top_provider_picks_most_frequent() {
        let pool = setup_pool().await;
        add(&pool, 1000, 5, 1000, "openai", "whisper-1").await;
        add(&pool, 2000, 5, 1000, "openai", "whisper-1").await;
        add(&pool, 3000, 5, 1000, "groq", "whisper-large-v3").await;
        assert_eq!(top_provider(&pool).await.unwrap(), Some("openai".into()));
    }

    #[tokio::test]
    async fn average_wpm_is_zero_when_empty() {
        let pool = setup_pool().await;
        assert_eq!(average_wpm(&pool).await.unwrap(), 0.0);
    }
}
