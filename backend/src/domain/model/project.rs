use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

// 切り出したモジュールをインポート
use super::diagram::Diagram;
use super::chat::ChatLog;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProjectId(pub Uuid);

impl ProjectId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

// Entity
#[derive(Debug, Clone)]
pub struct Project {
    pub id: ProjectId,
    pub title: String,
    pub scenario_id: String,
    pub last_modified: DateTime<Utc>,
    
    pub diagram: Diagram,       // 外部ファイル定義を使用
    pub chat_history: Vec<ChatLog>, // 外部ファイル定義を使用
    
    pub evaluation: Option<serde_json::Value>,
}

impl Project {
    pub fn new(
        id: ProjectId,
        title: String,
        scenario_id: String,
        diagram: Diagram,
        chat_history: Vec<ChatLog>,
    ) -> Self {
        Self {
            id,
            title,
            scenario_id,
            last_modified: Utc::now(),
            diagram,
            chat_history,
            evaluation: None,
        }
    }

    pub fn change_title(&mut self, new_title: String) {
        if !new_title.is_empty() {
            self.title = new_title;
            self.last_modified = Utc::now();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // 外部ファイルに移った型をインポート
    use crate::domain::model::diagram::{Diagram, Node, Position};
    use crate::domain::model::chat::ChatLog;

    // ヘルパー関数: テスト用のダミー図データ
    fn create_dummy_diagram() -> Diagram {
        Diagram {
            nodes: vec![
                Node { 
                    id: "1".to_string(), 
                    type_label: "LB".to_string(), 
                    position: Position { x: 0.0, y: 0.0 } 
                }
            ],
            edges: vec![],
        }
    }

    #[test]
    fn test_create_new_project() {
        let id = ProjectId::new();
        let title = "Test Project".to_string();
        let scenario = "test_scenario".to_string();
        let diagram = create_dummy_diagram();
        let chat = vec![ChatLog { role: "user".to_string(), content: "hi".to_string() }];

        let project = Project::new(
            id.clone(),
            title.clone(),
            scenario.clone(),
            diagram,
            chat
        );

        assert_eq!(project.id, id);
        assert_eq!(project.title, title);
        assert_eq!(project.diagram.nodes.len(), 1);
        assert_eq!(project.chat_history.len(), 1);
    }

    #[test]
    fn test_change_title() {
        let mut project = Project::new(
            ProjectId::new(),
            "Old Title".to_string(),
            "s1".to_string(),
            create_dummy_diagram(),
            vec![]
        );

        // 正常系
        project.change_title("New Title".to_string());
        assert_eq!(project.title, "New Title");

        // 異常系（空文字なら変更されないルール）
        project.change_title("".to_string());
        assert_eq!(project.title, "New Title");
    }
}