mod models;
mod gemini;

use axum::{
    extract::State,
    http::Method,
    routing::{get, post},
    Json, Router,
};
// SaveProjectRequest をインポートに追加
use models::{ArchitectureDiagram, ChatRequest, SaveProjectRequest}; 
use tower_http::cors::{Any, CorsLayer};
use sqlx::postgres::PgPoolOptions;
// PgPool と Row をまとめてインポート
use sqlx::{PgPool, Row}; 
use std::env;
use std::time::Duration;

#[tokio::main]
async fn main() {
    // 1. データベース接続設定
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://user:password@db:5432/arch_db".to_string());

    println!("Connecting to database...");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    println!("Database connected successfully!");

    // 2. CORS設定
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    // 3. ルーティング設定
    let app = Router::new()
        .route("/", get(|| async { "Hello, Architecture!" }))
        .route("/api/evaluate", post(evaluate_architecture))
        .route("/api/chat", post(handle_chat))
        .route("/api/projects", post(save_project)) // 保存用API
        .layer(cors)
        .with_state(pool); 

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("Backend listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}

// --- ハンドラ関数 ---

async fn evaluate_architecture(
    Json(payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    println!("Evaluating with Gemini...");
    match gemini::evaluate_with_gemini(&payload).await {
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
                }))
            }
        }
        Err(e) => {
            eprintln!("Gemini Error: {}", e);
            Json(serde_json::json!({ "score": 0, "feedback": "Error", "status": "error" }))
        }
    }
}

async fn handle_chat(
    Json(payload): Json<ChatRequest>,
) -> Json<serde_json::Value> {
    println!("Chat request for scenario: {}", payload.scenario_id);
    match gemini::chat_with_customer(&payload).await {
        Ok(reply) => Json(serde_json::json!({ "reply": reply, "status": "success" })),
        Err(e) => {
            eprintln!("Chat Error: {}", e);
            Json(serde_json::json!({ "reply": "Error", "status": "error" }))
        }
    }
}

// プロジェクト保存ハンドラ
async fn save_project(
    State(pool): State<PgPool>,
    Json(payload): Json<SaveProjectRequest>,
) -> Json<serde_json::Value> {
    println!("Saving project: {} ({})", payload.title, payload.id);

    // Upsertクエリ
    let query_result = sqlx::query!(
        r#"
        INSERT INTO projects (id, title, scenario_id, diagram_data, chat_history, last_modified)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE
        SET title = EXCLUDED.title,
            scenario_id = EXCLUDED.scenario_id,
            diagram_data = EXCLUDED.diagram_data,
            chat_history = EXCLUDED.chat_history,
            last_modified = NOW()
        "#,
        payload.id,
        payload.title,
        payload.scenario_id,
        payload.diagram_data,
        payload.chat_history
    )
    .execute(&pool)
    .await;

    match query_result {
        Ok(_) => Json(serde_json::json!({
            "id": payload.id,
            "status": "success",
            "message": "Project saved successfully"
        })),
        Err(e) => {
            eprintln!("Database Error: {}", e);
            Json(serde_json::json!({
                "status": "error",
                "message": "Failed to save project"
            }))
        }
    }
}