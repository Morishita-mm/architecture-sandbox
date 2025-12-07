use serde::{Deserialize, Serialize};

// フロントエンドから受け取る全体データ
#[derive(Debug, Deserialize, Serialize)]
pub struct ArchitectureDiagram {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

// ノード（Web Server, LBなど）
#[derive(Debug, Deserialize, Serialize)]
pub struct Node {
    pub id: String,
    #[serde(rename = "type")] // JSONのキー "type" をRustのフィールド "role" にマッピング
    pub role: String, 
    pub position: Position,
}

// 座標情報
#[derive(Debug, Deserialize, Serialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

// エッジ（接続線）
#[derive(Debug, Deserialize, Serialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
}

// --- チャット機能用 ---

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatRequest {
    pub scenario_id: String, // どのシナリオについて話しているか
    pub messages: Vec<ChatMessage>, // 会話履歴
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String, // "user" or "model" (Geminiの仕様に合わせる)
    pub content: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatResponse {
    pub reply: String,
}