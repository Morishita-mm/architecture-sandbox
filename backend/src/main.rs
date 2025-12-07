mod models;
mod gemini; // 追加

use axum::{
    http::Method,
    routing::{get, post},
    Json, Router,
};
use gemini::chat_with_customer;
use models::{ArchitectureDiagram, ChatRequest};
use tower_http::cors::{Any, CorsLayer};

#[tokio::main]
async fn main() {
    // ... CORS設定などは変更なし ...
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "Hello, Architecture!" }))
        .route("/api/evaluate", post(evaluate_architecture))
        .route("/api/chat", post(handle_chat))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("Backend listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}

async fn evaluate_architecture(
    Json(payload): Json<serde_json::Value>, // 柔軟に受け取るため一旦Valueにする
) -> Json<serde_json::Value> {
    println!("Evaluating with Gemini...");

    // Geminiを呼び出す
    match gemini::evaluate_with_gemini(&payload).await {
        Ok(ai_response_text) => {
            println!("Gemini Raw Response: {}", ai_response_text);
            
            // AIのレスポンス（文字列）をJSONとしてパースしてみる
            // ※ AIがMarkdown記号(```json)を含める場合があるので簡易的なクリーニング
            let clean_text = ai_response_text
                .replace("```json", "")
                .replace("```", "")
                .trim()
                .to_string();

            match serde_json::from_str::<serde_json::Value>(&clean_text) {
                Ok(json) => Json(json),
                Err(_) => {
                    // JSONパースに失敗した場合は生テキストを返す
                    Json(serde_json::json!({
                        "score": 0,
                        "feedback": clean_text,
                        "status": "partial_success"
                    }))
                }
            }
        }
        Err(e) => {
            eprintln!("Gemini Error: {}", e);
            Json(serde_json::json!({
                "score": 0,
                "feedback": "AI評価中にエラーが発生しました",
                "status": "error"
            }))
        }
    }
}

// チャットハンドラ
async fn handle_chat(
    Json(payload): Json<ChatRequest>,
) -> Json<serde_json::Value> {
    println!("Chat request for scenario: {}", payload.scenario_id);

    match chat_with_customer(&payload).await {
        Ok(reply) => Json(serde_json::json!({
            "reply": reply,
            "status": "success"
        })),
        Err(e) => {
            eprintln!("Chat Error: {}", e);
            Json(serde_json::json!({
                "reply": "申し訳ありません、通信エラーが発生しました。",
                "status": "error"
            }))
        }
    }
}