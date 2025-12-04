use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    // ルーティング設定: "/" にアクセスが来たら "Hello, World!" を返す
    let app = Router::new().route("/", get(|| async { "Hello, World!" }));

    // 0.0.0.0:8080 でリッスンする
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    
    println!("Listening on 0.0.0.0:8080");
    
    // サーバー起動
    axum::serve(listener, app).await.unwrap();
}