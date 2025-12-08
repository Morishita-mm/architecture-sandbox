# バックエンド用のDockerイメージ置き場
resource "aws_ecr_repository" "backend" {
  name                 = "architecture-sandbox-backend"
  image_tag_mutability = "MUTABLE"
  
  # 学習用設定: リポジトリの中にイメージが残っていても強制削除できるようにする
  # (本番では false にすることが多いです)
  force_delete = true 

  image_scanning_configuration {
    scan_on_push = true
  }
}

# 作成されたリポジトリのURLを出力する設定
output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}