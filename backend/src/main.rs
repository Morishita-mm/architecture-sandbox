mod domain;
mod infrastructure;

use axum::{
    Json, Router,
    http::Method,
    response::IntoResponse,
    routing::{get, post},
};
use reqwest::Client;
use reqwest::header::HeaderValue;
use std::env;
use tower_http::cors::{Any, CorsLayer};

use crate::domain::model::url_shorten::{ShortenRequest, ShortenResponse};
use domain::model::chat::ChatRequest;
use infrastructure::gemini::client as gemini_client;

#[tokio::main]
async fn main() {
    println!("Starting server without Database...");

    let frontend_origin =
        env::var("FRONTEND_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".to_string());

    // 2. CORS設定
    let cors = CorsLayer::new()
        .allow_origin(
            frontend_origin
                .parse::<HeaderValue>()
                .expect("Invalid FRONTEND_ORIGIN value"),
        )
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    // 3. ルーティング設定
    let app = Router::new()
        .route("/", get(|| async { "Hello, Architecture (Stateless)!" }))
        .route("/api/evaluate", post(evaluate_architecture))
        .route("/api/chat", post(handle_chat))
        .route("/api/projects", post(mock_save_project))
        .route("/api/shorten", post(shorten_url_handler))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("Backend listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}

// --- ハンドラー関数 ---

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

async fn mock_save_project(Json(payload): Json<serde_json::Value>) -> impl IntoResponse {
    println!("Mock Save Project: {:?}", payload.get("title"));
    println!("(Database is disabled, so data is not persisted)");

    // 成功レスポンスを返す
    Json(
        serde_json::json!({ "status": "success", "id": payload["id"], "message": "Saved to session (mock)" }),
    )
}

async fn shorten_url_handler(
    Json(payload): Json<ShortenRequest>,
) -> Result<Json<ShortenResponse>, String> {
    let client = Client::new();

    let api_url = format!(
        "https://tinyurl.com/api-create.php?url={}",
        payload.target_url
    );

    let resp = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let short_url = resp.text().await.map_err(|e| e.to_string())?;
        Ok(Json(ShortenResponse { short_url }))
    } else {
        Err("Failed to shorten URL".to_string())
    }
}
