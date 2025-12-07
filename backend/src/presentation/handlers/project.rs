use axum::{Json, extract::State};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::model::{
    chat::ChatLog,
    diagram::Diagram,
    project::{Project, ProjectId},
};
use crate::domain::repository::project_repository::ProjectRepository;
use crate::infrastructure::postgres::project_repository::PostgresProjectRepository;

#[derive(Deserialize)]
pub struct SaveProjectDto {
    pub id: Uuid,
    pub title: String,
    pub scenario_id: String,
    pub diagram_data: Diagram,
    pub chat_history: Vec<ChatLog>,
}

pub async fn save_project_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<SaveProjectDto>,
) -> Json<serde_json::Value> {
    println!("DDD Handler: Saving project: {}", payload.title);

    // 1. DTO -> Domain Entity への変換
    let project = Project::new(
        ProjectId(payload.id),
        payload.title,
        payload.scenario_id,
        payload.diagram_data,
        payload.chat_history,
    );

    // 2. Repositoryの初期化 (Infrastructure)
    let repo = PostgresProjectRepository::new(pool);

    // 3. ドメインロジックの実行 (Save)
    match repo.save(&project).await {
        Ok(_) => Json(serde_json::json!({
            "id": project.id.0,
            "status": "success",
            "message": "Project saved successfully via DDD"
        })),
        Err(e) => {
            eprintln!("Error saving project: {}", e);
            Json(serde_json::json!({
                "status": "error",
                "message": "Failed to save"
            }))
        }
    }
}
