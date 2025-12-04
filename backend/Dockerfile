# ベースイメージ
FROM rust:1-slim-bookworm

# 依存関係
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    pkg-config \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install cargo-watch --locked

WORKDIR /app

COPY . .

CMD ["cargo", "run"]