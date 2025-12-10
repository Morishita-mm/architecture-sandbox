use serde::{Deserialize, Serialize};

// リクエスト/レスポンスの型定義
#[derive(Deserialize)]
pub struct ShortenRequest {
    pub target_url: String,
}

#[derive(Serialize)]
pub struct ShortenResponse {
    pub short_url: String,
}
