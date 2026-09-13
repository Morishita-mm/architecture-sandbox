use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scenario {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub is_custom: bool,
    pub difficulty: Option<Difficulty>,
    pub partner_role: Option<PartnerRole>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Small,
    Medium,
    Large,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PartnerRole {
    Cfo,
    Cto,
    Ceo,
}

pub fn bounded(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.chars().count() <= max
}

impl Scenario {
    pub fn validate(&self) -> bool {
        bounded(&self.title, 120)
            && self.description.chars().count() <= 2000
            && match self.id.as_str() {
                "internal_tool" | "sns_app" => !self.is_custom && self.difficulty.is_none(),
                "custom" => self.is_custom && bounded(&self.description, 2000),
                _ => false,
            }
    }

    // Shared by the interviewer and evaluator; never serialized into public DTOs.
    pub fn requirements(&self) -> Value {
        match self.id.as_str() {
            "internal_tool" => {
                json!({"users":"社員50人", "traffic":"朝9時のみ集中、それ以外は低負荷", "availability":"夜間の短時間停止は許容、データ消失は不可", "budget":"低予算、過剰設計を避ける"})
            }
            "sns_app" => {
                json!({"users":"世界中の100万DAU", "traffic":"画像の投稿・閲覧とも高負荷、低レイテンシを重視", "availability":"24時間365日の稼働が必須", "budget":"性能を優先した高予算"})
            }
            _ => match self.difficulty.unwrap_or(Difficulty::Medium) {
                Difficulty::Small => {
                    json!({"users":"50〜100人程度", "traffic":"運用負荷の低い構成", "budget":"月額5,000円以内", "availability":"夜間停止可、ベストエフォート"})
                }
                Difficulty::Medium => {
                    json!({"users":"10万DAU、ピーク時秒間100リクエスト", "traffic":"急激なアクセス増への対応が必須", "budget":"月額50万円〜100万円", "availability":"高可用性、Multi-AZ推奨"})
                }
                Difficulty::Large => {
                    json!({"users":"1000万ユーザー、グローバル展開", "traffic":"単一障害点の排除とデータロス防止", "budget":"可用性とレイテンシを最優先", "availability":"24時間365日の稼働が必須"})
                }
            },
        }
    }

    pub fn public_context(&self) -> Value {
        match self.id.as_str() {
            "internal_tool" => {
                json!({"title":"社内勤怠管理システム", "description":"社員が出退勤を記録するシステム"})
            }
            "sns_app" => {
                json!({"title":"画像投稿SNS", "description":"写真を投稿しタイムラインで閲覧するアプリ"})
            }
            _ => json!({"title":self.title,"description":self.description}),
        }
    }

    pub fn partner_instruction(&self) -> &'static str {
        match self.partner_role.unwrap_or(PartnerRole::Ceo) {
            PartnerRole::Cfo => {
                "財務責任者として費用対効果と運用費を重視する。予算の質問には要件に基づき回答する。"
            }
            PartnerRole::Cto => {
                "技術責任者として安全性、可用性、拡張性と技術選定の根拠を重視する。質問された技術要件を回答する。"
            }
            PartnerRole::Ceo => {
                "非技術系オーナーとして最初は感覚的に話す。具体的な規模や予算について掘り下げられた場合にのみ、要件と矛盾しないヒントを出す。"
            }
        }
    }
}
