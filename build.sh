#!/bin/bash
docker build --no-cache --platform linux/amd64 --load --provenance=false -f backend/Dockerfile.prod -t test-app ./backend

# 2. タグ付け & プッシュ
export ECR_REPO_URL="876208240845.dkr.ecr.ap-northeast-1.amazonaws.com/architecture-sandbox-backend"
docker tag test-app $ECR_REPO_URL:latest
docker push $ECR_REPO_URL:latest

# ECR URLセット
export ECR_REPO_URL="876208240845.dkr.ecr.ap-northeast-1.amazonaws.com/architecture-sandbox-backend"

# タグ付け & プッシュ
docker tag test-app $ECR_REPO_URL:latest
docker push $ECR_REPO_URL:latest

# App Runner 更新
cd terraform
terraform destroy -target=aws_apprunner_service.backend -auto-approve
terraform apply -auto-approve

cd ../