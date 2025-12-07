use crate::domain::model::project::{Project, ProjectId};
use async_trait::async_trait;
use std::error::Error;

#[async_trait]
pub trait ProjectRepository: Send + Sync {
    // エラー型は特定の実装（sqlx::Error）に依存しないよう、汎用的なものにする
    // 本来は AppError などを定義すべきだが、今回は Box<dyn Error> で抽象化
    async fn save(&self, project: &Project) -> Result<(), Box<dyn Error>>;

    async fn find_by_id(&self, id: &ProjectId) -> Result<Option<Project>, Box<dyn Error>>;
}
