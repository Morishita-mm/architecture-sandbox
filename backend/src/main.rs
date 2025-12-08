mod domain;
mod infrastructure;
mod presentation;

use axum::{
    Json, Router,
    http::Method,
    routing::{get, post},
    response::IntoResponse,
};
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};

use domain::model::chat::ChatRequest;
use infrastructure::gemini::client as gemini_client;
use presentation::handlers::project::save_project_handler;

#[tokio::main]
async fn main() {
    // 1. データベース接続設定
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://user:password@db:5432/arch_db".to_string());

    println!("Connecting to database...");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(30)) 
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    println!("Database connected successfully!");

    let migration_sql = r#"
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      diagram_data JSONB,
      chat_history JSONB,
      evaluation JSONB
    );
    "#;
    sqlx::query(migration_sql)
        .execute(&pool)
        .await
        .expect("Failed to run migration");

    // 2. CORS設定
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    // 3. ルーティング設定
    let app = Router::new()
        .route("/", get(|| async { "Hello, Architecture!" }))
        .route("/api/evaluate", post(evaluate_architecture))
        .route("/api/chat", post(handle_chat))
        .route("/api/projects", post(save_project_handler))
        .layer(cors)
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("Backend listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}

async fn evaluate_architecture(Json(payload): Json<serde_json::Value>) -> impl IntoResponse {
    println!("Evaluating with Gemini...");
    match gemini_client::evaluate_with_gemini(&payload).await {
        Ok(ai_response_text) => {
            let clean_text = ai_response_text
                .replace("```json", "")
                .replace("```", "")
                .trim()
                .to_string();
            match serde_json::from_str::<serde_json::Value>(&clean_text) {
                Ok(json) => Json(json),
                Err(_) => Json(serde_json::json!({
                    "score": 0, "feedback": clean_text, "status": "partial_success"
                })),
            }
        }
        Err(e) => {
            eprintln!("Gemini Error: {}", e);
            Json(serde_json::json!({ "score": 0, "feedback": "Error", "status": "error" }))
        }
    }
}

async fn handle_chat(Json(payload): Json<ChatRequest>) -> impl IntoResponse {
    println!("Chat request for scenario: {}", payload.scenario_id);
    match gemini_client::chat_with_customer(&payload).await {
        Ok(reply) => Json(serde_json::json!({ "reply": reply, "status": "success" })),
        Err(e) => {
            eprintln!("Chat Error: {}", e);
            Json(serde_json::json!({ "reply": "Error", "status": "error" }))
        }
    }
}