use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatLog {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatRequest {
    pub scenario_id: String,
    pub messages: Vec<ChatLog>,
    pub partner_role: Option<String>,
}
