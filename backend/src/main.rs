mod domain;
mod infrastructure;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{Method, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use domain::model::{
    chat::ChatRequest,
    evaluation::{EvaluationRequest, EvaluationResult},
    url_shorten::{ShortenRequest, ShortenResponse},
};
use infrastructure::gemini::client::{GeminiClient, bounded_body};
use reqwest::Url;
use std::{
    env,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::{Semaphore, SemaphorePermit};
use tower_http::cors::CorsLayer;

struct AppState {
    gemini: GeminiClient,
    origin: Url,
    concurrent: Semaphore,
    budget: Mutex<Budget>,
}

// Per-process circuit breakers, not identity-based quotas or a billing cap.
struct Budget {
    minute: (Instant, u32),
    hour: (Instant, u32),
}
impl Budget {
    fn new() -> Self {
        Self {
            minute: (Instant::now(), 0),
            hour: (Instant::now(), 0),
        }
    }
    fn take(&mut self) -> bool {
        if self.minute.0.elapsed() >= Duration::from_secs(60) {
            self.minute = (Instant::now(), 0);
        }
        if self.hour.0.elapsed() >= Duration::from_secs(3600) {
            self.hour = (Instant::now(), 0);
        }
        if self.minute.1 >= 30 || self.hour.1 >= 300 {
            return false;
        }
        self.minute.1 += 1;
        self.hour.1 += 1;
        true
    }
}
impl AppState {
    fn admit(&self) -> Result<SemaphorePermit<'_>, ApiError> {
        let permit = self.concurrent.try_acquire().map_err(|_| ApiError::Busy)?;
        if !self
            .budget
            .lock()
            .map_err(|_| ApiError::Unavailable)?
            .take()
        {
            return Err(ApiError::Busy);
        }
        Ok(permit)
    }
}

enum ApiError {
    Invalid,
    Upstream,
    Busy,
    Unavailable,
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Self::Invalid => (
                StatusCode::BAD_REQUEST,
                "入力内容またはサイズを確認してください。",
            ),
            Self::Upstream => (
                StatusCode::BAD_GATEWAY,
                "外部サービスの応答を取得できませんでした。時間を置いて再度お試しください。",
            ),
            Self::Busy => (
                StatusCode::TOO_MANY_REQUESTS,
                "利用が集中しています。時間を置いて再度お試しください。",
            ),
            Self::Unavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "現在サービスを利用できません。",
            ),
        };
        let mut response = (status, Json(serde_json::json!({"error":message}))).into_response();
        if status == StatusCode::TOO_MANY_REQUESTS {
            response
                .headers_mut()
                .insert(header::RETRY_AFTER, "60".parse().unwrap());
        }
        response
    }
}

#[tokio::main]
async fn main() {
    let gemini = GeminiClient::from_env()
        .expect("Invalid architecture definitions or provider configuration");
    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "8080".into())
        .parse()
        .expect("PORT must be an integer between 1 and 65535");
    assert!(port > 0, "PORT must not be zero");
    let frontend_origin =
        env::var("FRONTEND_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".into());
    let origin = Url::parse(&frontend_origin).expect("Invalid FRONTEND_ORIGIN");
    assert!(
        origin.origin().ascii_serialization() == frontend_origin
            && origin.username().is_empty()
            && origin.password().is_none()
            && (origin.scheme() == "https"
                || (origin.scheme() == "http"
                    && matches!(origin.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")))),
        "FRONTEND_ORIGIN must be an HTTPS origin (HTTP only for localhost)"
    );
    let state = Arc::new(AppState {
        gemini,
        origin,
        concurrent: Semaphore::new(2),
        budget: Mutex::new(Budget::new()),
    });
    let cors = CorsLayer::new()
        .allow_origin(frontend_origin.parse::<header::HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE]);
    let app = Router::new()
        .route("/", get(|| async { "Hello, Architecture (Stateless)!" }))
        .route(
            "/healthz",
            get(|| async { Json(serde_json::json!({"status":"ok"})) }),
        )
        .route("/api/evaluate", post(evaluate_architecture))
        .route("/api/chat", post(handle_chat))
        .route("/api/shorten", post(shorten_url_handler))
        .layer(DefaultBodyLimit::max(128 * 1024))
        .layer(axum::middleware::map_response(
            |mut response: Response| async move {
                response
                    .headers_mut()
                    .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
                response
                    .headers_mut()
                    .insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
                response
            },
        ))
        .layer(cors)
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("Failed to bind HTTP listener");
    println!("Backend listening on 0.0.0.0:{port}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("HTTP server failed");
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

async fn evaluate_architecture(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<EvaluationRequest>,
) -> Result<Json<EvaluationResult>, ApiError> {
    if !payload.validate(&state.gemini.available_types) {
        return Err(ApiError::Invalid);
    }
    let _permit = state.admit()?;
    state
        .gemini
        .evaluate(&payload)
        .await
        .map(Json)
        .map_err(|_| ApiError::Upstream)
}

async fn handle_chat(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ChatRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if !payload.validate() {
        return Err(ApiError::Invalid);
    }
    let _permit = state.admit()?;
    let reply = state
        .gemini
        .chat(&payload)
        .await
        .map_err(|_| ApiError::Upstream)?;
    Ok(Json(serde_json::json!({"reply":reply})))
}

fn valid_share_url(target: &str, origin: &Url) -> bool {
    if target.len() > 24000 {
        return false;
    }
    let Ok(url) = Url::parse(target) else {
        return false;
    };
    let params: Vec<_> = url.query_pairs().collect();
    url.origin() == origin.origin()
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && url.path() == "/"
        && params.len() == 1
        && params[0].0 == "challenge"
        && !params[0].1.is_empty()
}

async fn shorten_url_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ShortenRequest>,
) -> Result<Json<ShortenResponse>, ApiError> {
    if !valid_share_url(&payload.target_url, &state.origin) {
        return Err(ApiError::Invalid);
    }
    let _permit = state.admit()?;
    let response = state
        .gemini
        .http
        .get("https://tinyurl.com/api-create.php")
        .timeout(Duration::from_secs(15))
        .query(&[("url", &payload.target_url)])
        .send()
        .await
        .map_err(|_| ApiError::Upstream)?;
    if !response.status().is_success() {
        return Err(ApiError::Upstream);
    }
    let bytes = bounded_body(response, 2048)
        .await
        .map_err(|_| ApiError::Upstream)?;
    let short_url = String::from_utf8(bytes)
        .map_err(|_| ApiError::Upstream)?
        .trim()
        .to_owned();
    let url = Url::parse(&short_url).map_err(|_| ApiError::Upstream)?;
    if url.scheme() != "https"
        || url.host_str() != Some("tinyurl.com")
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() == "/"
    {
        return Err(ApiError::Upstream);
    }
    Ok(Json(ShortenResponse { short_url }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn share_destination_is_exact() {
        let origin = Url::parse("https://sandbox.morimizu.dev").unwrap();
        assert!(valid_share_url(
            "https://sandbox.morimizu.dev/?challenge=test",
            &origin
        ));
        for url in [
            "https://evil.example/?challenge=x",
            "https://sandbox.morimizu.dev.evil.example/?challenge=x",
            "https://user@sandbox.morimizu.dev/?challenge=x",
            "http://sandbox.morimizu.dev/?challenge=x",
            "https://sandbox.morimizu.dev/redirect?challenge=x",
            "https://sandbox.morimizu.dev/?challenge=x&next=https://evil.example",
            "https://sandbox.morimizu.dev/?challenge=x#secret",
        ] {
            assert!(!valid_share_url(url, &origin), "{url}");
        }
    }
    #[test]
    fn budget_has_minute_and_hour_limits() {
        let mut budget = Budget::new();
        for _ in 0..30 {
            assert!(budget.take());
        }
        assert!(!budget.take());
        budget.minute.0 = Instant::now() - Duration::from_secs(61);
        assert!(budget.take());
        budget.hour.1 = 300;
        assert!(!budget.take());
        budget.hour.0 = Instant::now() - Duration::from_secs(3601);
        assert!(budget.take());
    }
}
