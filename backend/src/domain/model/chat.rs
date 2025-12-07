use serde::{Deserialize, Serialize};

// DB保存用にも、APIリクエスト用にも使えるチャット関連の定義

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatLog {
    pub role: String,
    pub content: String,
}

// 以前 models.rs にあった ChatRequest をここに定義
#[derive(Debug, Deserialize, Serialize)]
pub struct ChatRequest {
    pub scenario_id: String,
    pub messages: Vec<ChatLog>,
}
