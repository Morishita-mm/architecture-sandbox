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
use std::{env, time::Duration};
use tower_http::cors::{Any, CorsLayer};

use crate::domain::model::url_shorten::{ShortenRequest, ShortenResponse};
use domain::model::chat::ChatRequest;
use infrastructure::gemini::client as gemini_client;

#[tokio::main]
async fn main() {
    // Fail before accepting traffic when a deployment is missing its configuration.
    let api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set");
    assert!(
        !api_key.trim().is_empty(),
        "GEMINI_API_KEY must not be empty"
    );
    gemini_client::validate_architecture_defs().expect("Invalid architecture definitions");
    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "8080".into())
        .parse()
        .expect("PORT must be an integer between 1 and 65535");
    assert!(port > 0, "PORT must not be zero");

    let frontend_origin =
        env::var("FRONTEND_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".to_string());

    let app = app(&frontend_origin);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("Failed to bind HTTP listener");
    println!("Backend listening on 0.0.0.0:{port}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("HTTP server failed");
}

fn app(frontend_origin: &str) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(
            frontend_origin
                .parse::<HeaderValue>()
                .expect("Invalid FRONTEND_ORIGIN value"),
        )
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    // 3. ルーティング設定
    Router::new()
        .route("/", get(|| async { "Hello, Architecture (Stateless)!" }))
        .route(
            "/healthz",
            get(|| async { Json(serde_json::json!({ "status": "ok" })) }),
        )
        .route("/api/evaluate", post(evaluate_architecture))
        .route("/api/chat", post(handle_chat))
        .route("/api/projects", post(mock_save_project))
        .route("/api/shorten", post(shorten_url_handler))
        .layer(cors)
}

async fn shutdown_signal() {
    let interrupt = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl-C handler")
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = interrupt => {}, _ = terminate => {} }
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
            Json(serde_json::json!({ "score": 0, "feedback": e.to_string(), "status": "error" }))
        }
    }
}

async fn handle_chat(Json(payload): Json<ChatRequest>) -> impl IntoResponse {
    println!("Chat request for scenario: {}", payload.scenario_id);
    match gemini_client::chat_with_customer(&payload).await {
        Ok(reply) => Json(serde_json::json!({ "reply": reply, "status": "success" })),
        Err(e) => {
            eprintln!("Chat Error: {}", e);
            Json(serde_json::json!({ "reply": e.to_string(), "status": "error" }))
        }
    }
}

async fn mock_save_project(Json(payload): Json<serde_json::Value>) -> impl IntoResponse {
    // 成功レスポンスを返す
    Json(
        serde_json::json!({ "status": "success", "id": payload["id"], "message": "Saved to session (mock)" }),
    )
}

async fn shorten_url_handler(
    Json(payload): Json<ShortenRequest>,
) -> Result<Json<ShortenResponse>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "Failed to initialize URL shortener".to_string())?;

    let resp = client
        .get("https://tinyurl.com/api-create.php")
        .query(&[("url", &payload.target_url)])
        .send()
        .await
        .map_err(|_| "Failed to reach URL shortener".to_string())?;

    if resp.status().is_success() {
        let short_url = resp.text().await.map_err(|e| e.to_string())?;
        Ok(Json(ShortenResponse { short_url }))
    } else {
        Err("Failed to shorten URL".to_string())
    }
}
