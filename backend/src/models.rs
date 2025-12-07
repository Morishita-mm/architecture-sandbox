use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

// --- プロジェクト保存用 ---

#[derive(Debug, Deserialize, Serialize)]
pub struct SaveProjectRequest {
    pub id: Uuid,              // プロジェクトID (フロント側で生成または管理)
    pub title: String,         // プロジェクト名
    pub scenario_id: String,   // 選択中のシナリオ
    pub diagram_data: serde_json::Value, // ノードとエッジ (JSONB)
    pub chat_history: serde_json::Value, // チャット履歴 (JSONB)
    // evaluation はまだ保存しなくてOK（再評価すれば良いので）
}

#[derive(Debug, Serialize)]
pub struct SaveProjectResponse {
    pub id: Uuid,
    pub status: String,
}