#![allow(clippy::collapsible_if)]

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;

use crate::domain::model::chat::ChatRequest;

#[derive(Deserialize)]
struct ArchitectureDefs {
    categories: Vec<Category>,
}

#[derive(Deserialize)]
struct Category {
    items: Vec<Item>,
}

#[derive(Deserialize)]
struct Item {
    #[serde(rename = "type")] // JSONの "type" フィールドをマッピング
    type_name: String,
}

// --- Gemini APIのリクエスト形式 (構造体定義) ---
#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
}

#[derive(Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize)]
struct Part {
    text: String,
}

// --- Gemini APIのレスポンス形式 (構造体定義) ---
#[derive(Deserialize, Debug)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize, Debug)]
struct Candidate {
    content: Option<CandidateContent>,
}

#[derive(Deserialize, Debug)]
struct CandidateContent {
    parts: Option<Vec<PartResponse>>,
}

#[derive(Deserialize, Debug)]
struct PartResponse {
    text: String,
}

// --- プロンプト生成関数 ---
fn build_system_prompt() -> String {
    // 1. プロンプトテンプレートを読み込む (コンパイル時に埋め込み)
    let template = include_str!("system_prompt.txt");

    // 2. フロントエンドのJSON定義を読み込む
    // backend/src/infrastructure/gemini/client.rs から見たパス
    let json_str = include_str!("../../../../frontend/src/constants/architecture_defs.json");

    // 3. JSONをパースしてコンポーネントリストを作る
    let defs: ArchitectureDefs =
        serde_json::from_str(json_str).expect("Failed to parse architecture_defs.json");

    let mut components = String::new();
    for category in defs.categories {
        for item in category.items {
            // YAMLのリスト形式 "- Name" に整形
            components.push_str(&format!("    - \"{}\"\n", item.type_name));
        }
    }

    // 4. テンプレート内のプレースホルダーを置換
    template.replace("{{AVAILABLE_COMPONENTS}}", &components)
}

fn get_difficulty_specs(difficulty: &str) -> serde_json::Value {
    match difficulty {
        "small" => serde_json::json!({
            "users": "50〜100人程度",
            "traffic": "運用コストをかけられないため、メンテナンスフリーな構成を好む",
            "budget": "月額5,000円以内 (可能な限り安く)",
            "availability": "Best Effort (夜間停止可)"
        }),
        "medium" => serde_json::json!({
             "users": "10万DAU, ピーク時秒間100リクエスト",
             "traffic": "急激なアクセス増に耐えられるスケーラビリティが必須",
             "budget": "月額50万円〜100万円",
             "availability": "High (Multi-AZ推奨)"
        }),
        "large" => serde_json::json!({
             "users": "1000万ユーザー, グローバル展開",
             "traffic": "単一障害点(SPOF)の完全排除と、データロス発生時の法的リスク回避",
             "budget": "無制限（可用性とレイテンシが最優先）",
             "availability": "Critical (24/7)"
        }),
        _ => serde_json::json!({ // デフォルト
             "users": "10万DAU",
             "traffic": "Standard",
             "budget": "Standard",
             "availability": "High"
        }),
    }
}

// --- 評価関数 ---
pub async fn evaluate_with_gemini(json_data: &Value) -> Result<String, Box<dyn std::error::Error>> {
    let api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set");
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    let mut final_json = json_data.clone();

    if let Some(scenario) = final_json.get_mut("scenario") {
        // カスタムフラグのチェック
        let is_custom = scenario
            .get("isCustom")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if is_custom {
            // 難易度の取得
            let difficulty = scenario
                .get("difficulty")
                .and_then(|v| v.as_str())
                .unwrap_or("medium");

            println!(
                "Detected Custom Scenario! Injecting specs for difficulty: {}",
                difficulty
            );

            // 正解スペックの取得
            let specs = get_difficulty_specs(difficulty);

            // requirementsフィールドの上書き
            // フロントエンドでは "AI決定" 等のダミーが入っているため、ここで真の値をセットする
            if let Some(reqs) = scenario.get_mut("requirements") {
                *reqs = specs;
            }
        }
    }

    // プロンプトの作成
    let system_prompt = build_system_prompt();

    // プロンプト結合
    let prompt = format!("{}\nUser Design Data:\n{}", system_prompt, final_json);

    let request_body = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part { text: prompt }],
        }],
    };

    let client = Client::new();
    let res = client.post(&url).json(&request_body).send().await?;

    // エラーハンドリング
    let status = res.status();
    if !status.is_success() {
        let error_body = res.text().await?;
        eprintln!("Gemini API Error! Status: {}", status);
        eprintln!("Error Body: {}", error_body);
        return Err(format!("Gemini API error: {}", status).into());
    }

    let body_text = res.text().await?;
    let response_json: GeminiResponse = serde_json::from_str(&body_text)?;

    if let Some(candidates) = response_json.candidates {
        if let Some(first) = candidates.first() {
            if let Some(content) = &first.content {
                if let Some(parts) = &content.parts {
                    if let Some(part) = parts.first() {
                        return Ok(part.text.clone());
                    }
                }
            }
        }
    }

    Err("Failed to parse Gemini response".into())
}

pub async fn chat_with_customer(req: &ChatRequest) -> Result<String, Box<dyn std::error::Error>> {
    let api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set");
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    // 1. ベースとなるシステム指示の取得
    let mut system_instruction = String::new();
    let mut chat_history_start_index = 0;

    if req.scenario_id == "custom" {
        // カスタムの場合: フロントエンドからの system メッセージを採用
        if let Some(first_msg) = req.messages.first() {
            if first_msg.role == "system" {
                system_instruction = first_msg.content.clone();
                chat_history_start_index = 1;
            }
        }
        if system_instruction.is_empty() {
            system_instruction = "あなたはシステムアーキテクチャのクライアントです。".to_string();
        }
    } else {
        let hidden_context = match req.scenario_id.as_str() {
            "internal_tool" => {
                "
                あなたは「社内勤怠管理ツール」の発注担当者（総務部）です。
                ITには詳しくありません。
                【裏要件】
                - 予算はとにかく安く済ませたい。
                - 朝9時に社員50人が一斉にアクセスするが、それ以外は誰も使わない。
                - データは消えると困るが、数分止まるくらいなら許容できる。
            "
            }
            "sns_app" => {
                "
                あなたは「次世代SNSアプリ」のスタートアップCEOです。
                野心的で、急成長を想定しています。
                【裏要件】
                - 世界中からアクセスがある想定。
                - とにかく「サクサク動く」ことが最重要。
                - 24時間365日止まってはいけない。
            "
            }
            _ => "あなたは一般的なシステムの顧客です。",
        };

        system_instruction = format!(
            r#"
            {}
            ユーザー（システムアーキテクト）からの質問に対して、上記の立場・要件に基づいて回答してください。
            回答は短潔に、かつ自然な会話口調で行ってください。
            "#,
            hidden_context
        );
    }

    // パートナー役割の取得とプロンプト結合
    let role = req.partner_role.as_deref().unwrap_or("ceo");
    let partner_instruction = get_partner_instruction(role);

    let final_system_instruction = format!("{}\n\n{}", system_instruction, partner_instruction);

    let mut full_prompt = String::new();
    // ★修正箇所: system_instruction ではなく final_system_instruction を使用する
    full_prompt.push_str(&final_system_instruction);
    
    // デバッグ出力
    println!("--- Full System Prompt ---\n{}\n--------------------------", &full_prompt);
    
    full_prompt.push_str("\n\n--- 会話履歴 ---\n");

    // 会話履歴の構築
    for (i, msg) in req.messages.iter().enumerate() {
        if i < chat_history_start_index {
            continue;
        }
        if msg.role == "system" {
            continue;
        }

        let speaker = if msg.role == "user" {
            "Architect"
        } else {
            "Client"
        };
        full_prompt.push_str(&format!("{}: {}\n", speaker, msg.content));
    }
    full_prompt.push_str("Client: ");

    let request_body = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part { text: full_prompt }],
        }],
    };

    let client = Client::new();
    let res = client.post(&url).json(&request_body).send().await?;

    // エラーハンドリング
    let status = res.status();
    if !status.is_success() {
        let error_body = res.text().await?;
        eprintln!("Gemini API Error! Status: {}", status);
        eprintln!("Error Body: {}", error_body);
        return Err(format!("Gemini API error: {}", status).into());
    }

    let body_text = res.text().await?;
    let response_json: GeminiResponse = serde_json::from_str(&body_text)?;

    if let Some(candidates) = response_json.candidates {
        if let Some(first) = candidates.first() {
            if let Some(content) = &first.content {
                if let Some(parts) = &content.parts {
                    if let Some(part) = parts.first() {
                        return Ok(part.text.clone());
                    }
                }
            }
        }
    }

    Err("No response".into())
}

fn get_partner_instruction(role: &str) -> &'static str {
    match role {
        "cfo" => concat!(
            "\n【重要：あなたの役割 - 財務担当 (CFO)】\n",
            "あなたはコスト意識が非常に高い財務責任者として振る舞ってください。\n",
            "技術的な詳細は理解していませんが、「費用対効果」と「無駄の削減」には敏感です。\n",
            "・「その機能は本当に売上に貢献するのか？」「もっと安い方法はないのか？」としつこく聞いてください。\n",
            "・AWSやクラウドの高額なサービス名が出たら、コスト面での懸念を示してください。\n",
            "・安易なオーバースペック（過剰品質）を許さないでください。"
        ),
        "cto" => concat!(
            "\n【重要：あなたの役割 - 技術責任者 (CTO)】\n",
            "あなたは技術に精通したCTOとして振る舞ってください。\n",
            "・セキュリティ、可用性、スケーラビリティについて厳しくチェックしてください。\n",
            "・単一障害点（SPOF）がある場合、即座に指摘してください。\n",
            "・「なんとなく」選ばれた技術選定を嫌います。すべての構成に技術的な根拠を求めてください。\n",
            "・甘い設計に対しては、プロフェッショナルとして厳しいフィードバックをしてください。"
        ),
        "ceo" => concat!(
            "\n【重要：あなたの役割 - 非技術系オーナー (CEO)】\n",
            "あなたは技術に詳しくないビジネスオーナーです。夢やビジョンを語りますが、具体的な要件（数値）はあいまいで、気分で変わることがあります。\n",
            "\n",
            "【最重要ルール：Hidden_Context情報の隠蔽】\n",
            "あなたはシステム設定（Hidden_Context）として「正解の数値（ユーザー数や予算）」を知っていますが、**絶対にそれをそのまま答えないでください。**\n",
            "前述の `Behavior_Rules` に「聞かれたら答える」とあっても、CEOの場合は**「曖昧にはぐらかす」**ことを優先してください。\n",
            "\n",
            "【回答ガイドライン】\n",
            "1. ユーザーから「ユーザー数は？」「予算は？」と聞かれても、まずは「うーん、世界中でバズるくらい！」「安く済ませてよ」などと**感覚的な言葉**で返してください。\n",
            "2. 具体的な数字（例: 100万人、50万円）は使わず、「桁違いの規模」「お小遣い程度」のように言い換えてください。\n",
            "3. ユーザーが困って「具体的なサーバーのスペックを決めるために必要なんです」などと食い下がってきた場合のみ、「まあ、強いて言うなら...」と渋々、少しだけヒントを出してください。\n",
            "4. 専門用語を使われても「よく分からないけど、実現できるの？」「なんかカッコいい感じで頼むよ」と返してください。"
        ),
        _ => "\n【役割】一般的なクライアントとして振る舞ってください。",
    }
}