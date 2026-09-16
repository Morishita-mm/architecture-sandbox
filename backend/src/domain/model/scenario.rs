use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioCondition {
    pub id: String,
    pub label: String,
}

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
    pub custom_mode: Option<CustomMode>,
    pub scenario_family: Option<ScenarioFamily>,
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

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CustomMode {
    Guided,
    SelfDefined,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScenarioFamily {
    Business,
    Content,
    Realtime,
    Transaction,
}

pub fn bounded(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.chars().count() <= max
}

impl Scenario {
    pub fn validate(&self) -> bool {
        bounded(&self.title, 120)
            && self.description.chars().count() <= 2000
            && match self.id.as_str() {
                "internal_tool" | "sns_app" => {
                    !self.is_custom
                        && self.difficulty.is_none()
                        && self.custom_mode.is_none()
                        && self.scenario_family.is_none()
                }
                "custom" => {
                    self.is_custom
                        && bounded(&self.description, 2000)
                        && match self.custom_mode {
                            None => self.scenario_family.is_none(),
                            Some(CustomMode::Guided) => {
                                self.difficulty.is_some() && self.scenario_family.is_some()
                            }
                            Some(CustomMode::SelfDefined) => {
                                self.difficulty.is_none() && self.scenario_family.is_none()
                            }
                        }
                }
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
            _ if self.custom_mode == Some(CustomMode::Guided) => self.guided_requirements(),
            _ if self.custom_mode == Some(CustomMode::SelfDefined) => json!({
                "source":"利用者が入力したテーマ説明だけを仕様として扱う",
                "hiddenRequirements":"なし",
                "evaluation":"説明に明記された条件との整合を確認し、規模・負荷・保存・応答・故障・権限・予算・運用で未定義の項目は欠陥と断定せず『仕様の未定義』として質問する"
            }),
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

    pub fn condition_catalog(&self) -> Vec<ScenarioCondition> {
        if self.custom_mode == Some(CustomMode::SelfDefined) {
            return Vec::new();
        }
        const ORDER: &[&str] = &[
            "users",
            "traffic",
            "response",
            "delivery",
            "freshness",
            "availability",
            "reliability",
            "failure",
            "overload",
            "offline",
            "reconnect",
            "presence",
            "data",
            "storage",
            "consistency",
            "access",
            "deletion",
            "operations",
            "budget",
        ];
        let Value::Object(requirements) = self.requirements() else {
            return Vec::new();
        };
        let mut keys: Vec<_> = requirements.keys().cloned().collect();
        keys.sort_by_key(|key| {
            ORDER
                .iter()
                .position(|candidate| candidate == key)
                .unwrap_or(ORDER.len())
        });
        keys.into_iter()
            .map(|id| ScenarioCondition {
                label: condition_label(&id).to_string(),
                id,
            })
            .collect()
    }

    pub fn has_condition(&self, id: &str) -> bool {
        self.condition_catalog().iter().any(|item| item.id == id)
    }

    pub fn condition_value(&self, id: &str) -> Option<String> {
        self.requirements()
            .as_object()?
            .get(id)?
            .as_str()
            .map(str::to_owned)
    }

    fn guided_requirements(&self) -> Value {
        match (
            self.scenario_family.unwrap_or(ScenarioFamily::Business),
            self.difficulty.unwrap_or(Difficulty::Medium),
        ) {
            (ScenarioFamily::Business, Difficulty::Small) => json!({
                "users":"利用者100人。平日の業務時間に利用",
                "traffic":"始業前の5分間に80件の主要操作。最大10件/秒",
                "response":"主要操作の受付結果を2秒以内",
                "data":"業務記録を3年保存。受付済み記録をアプリ1台の停止で失わない",
                "access":"本人・担当者・管理者の閲覧範囲を分ける",
                "operations":"兼任1人で運用。予定した夜間停止は30分まで許容",
                "budget":"教材上の月額目標3万円。実料金の達成は図だけで断定しない"
            }),
            (ScenarioFamily::Business, Difficulty::Medium) => json!({
                "users":"利用者3,000人。24時間利用",
                "traffic":"交代時の2分間に2,400件。平均20件/秒、最大100件/秒",
                "response":"主要操作の受付結果を1秒以内。日次集計は翌朝まででよい",
                "reliability":"アプリ1台の停止後60秒以内に受付を再開",
                "data":"業務記録を3年保存し、再送しても同じ操作を二重に記録しない",
                "access":"担当範囲と全体管理の権限を分ける",
                "operations":"担当2人。深夜の手作業による台数調整を避ける"
            }),
            (ScenarioFamily::Business, Difficulty::Large) => json!({
                "users":"利用者10,000人、50拠点。24時間利用",
                "traffic":"中央サービスの復旧時に10,000件を10分以内に同期。初期最大200件/秒",
                "response":"オンライン操作は2秒以内。切断中は端末へ1秒以内に仮保存",
                "offline":"通信断が30分続いても仮保存し、復旧後10分以内に同期",
                "data":"仮保存と中央の受付完了を区別し、再送の重複と訂正履歴を扱う",
                "access":"本人・拠点責任者・全体管理者の閲覧範囲を分ける",
                "operations":"運用担当3人。未同期の記録を確認できる"
            }),
            (ScenarioFamily::Content, Difficulty::Small) => json!({
                "users":"1,000 DAU",
                "traffic":"投稿100件/日、一覧1万回/日。集中時の一覧20回/秒",
                "response":"一覧データ1秒以内、先頭の画像10枚を3秒以内",
                "freshness":"投稿の一覧反映は60秒以内でよい",
                "storage":"平均2MBのデータを1年保存",
                "access":"会員限定。URLを知る非会員にもデータを返さない",
                "operations":"兼任1人、教材上の月額目標2万円"
            }),
            (ScenarioFamily::Content, Difficulty::Medium) => json!({
                "users":"100万 DAU。日本40%、北米30%、欧州30%",
                "traffic":"投稿10万件/日、一覧1,000万回/日。集中時の一覧2,000回/秒",
                "response":"各地域で一覧データ1秒以内、先頭の画像10枚を2秒以内",
                "freshness":"投稿の一覧反映は30秒以内、集計値は60秒遅れてよい",
                "storage":"平均2MBの元データを1年保存。閲覧用の軽量データを別に持てる",
                "reliability":"アプリ1台の停止後60秒以内に閲覧を再開",
                "deletion":"削除後60秒以内に新しい閲覧を拒否"
            }),
            (ScenarioFamily::Content, Difficulty::Large) => json!({
                "users":"10万 DAU。イベント中に利用",
                "traffic":"発表直後1分間の一覧2万回/秒、投稿100件/秒",
                "response":"一覧データ0.5秒以内、先頭の画像10枚を3秒以内",
                "freshness":"投稿を2秒以内に他の利用者の一覧へ反映。集計値は30秒遅れてよい",
                "storage":"平均2MBの元データを30日保存",
                "overload":"処理不能時は待機・再試行を示し、成功したように見せて捨てない",
                "data":"再送で同じ投稿を二重に作らない"
            }),
            (ScenarioFamily::Realtime, Difficulty::Small) => json!({
                "users":"1,000 DAU、同時接続100人",
                "traffic":"通常20メッセージ/秒、最大100メッセージ/秒",
                "delivery":"受付済みメッセージの95%を5秒以内に相手へ届ける",
                "reconnect":"切断後に再接続し、未読を取得できる",
                "data":"メッセージを30日保存。再送による重複を区別する",
                "operations":"兼任1人で運用"
            }),
            (ScenarioFamily::Realtime, Difficulty::Medium) => json!({
                "users":"10万 DAU、同時接続1万人",
                "traffic":"通常1,000メッセージ/秒、最大5,000メッセージ/秒",
                "delivery":"受付済みメッセージの95%を2秒以内に相手へ届ける",
                "presence":"オンライン状態は30秒遅れてよい",
                "reliability":"アプリ1台の停止中も接続先を切り替え、受付済みを失わない",
                "data":"会話単位の順序を保ち、再送による重複を区別する"
            }),
            (ScenarioFamily::Realtime, Difficulty::Large) => json!({
                "users":"100万 DAU、同時接続10万人。複数地域から利用",
                "traffic":"通常1万メッセージ/秒、最大5万メッセージ/秒",
                "delivery":"同一地域は1秒、地域間は3秒以内に95%を届ける",
                "reconnect":"5分の切断後も未読と既読位置を復元",
                "reliability":"単一地域の停止時は60秒以内に別地域で受付を再開",
                "data":"会話単位の順序、重複防止、利用者ごとの公開範囲を守る"
            }),
            (ScenarioFamily::Transaction, Difficulty::Small) => json!({
                "users":"1,000 DAU",
                "traffic":"取引100件/日、最大10件/秒",
                "response":"受付結果を2秒以内",
                "consistency":"同じ対象を二重に確定しない。再送でも取引を重複作成しない",
                "data":"取引記録を1年保存し、状態変更の履歴を残す",
                "access":"本人と運営担当者の操作範囲を分ける",
                "operations":"兼任1人で運用"
            }),
            (ScenarioFamily::Transaction, Difficulty::Medium) => json!({
                "users":"10万 DAU",
                "traffic":"取引1万件/日、集中時500件/秒",
                "response":"在庫確認を1秒、取引受付を2秒以内",
                "consistency":"在庫・席・商品を二重に確定せず、再試行は同じ結果を返す",
                "failure":"決済等の外部処理が失敗・遅延した状態を記録し、再開できる",
                "data":"取引と状態変更を3年保存",
                "reliability":"アプリ1台の停止後60秒以内に受付を再開"
            }),
            (ScenarioFamily::Transaction, Difficulty::Large) => json!({
                "users":"100万 DAU。複数地域から利用",
                "traffic":"取引10万件/日、イベント開始時5,000件/秒",
                "response":"受付を2秒以内。完了に時間がかかる場合は処理中の状態を返す",
                "consistency":"限られた在庫を二重に確定せず、再送・タイムアウト・遅延応答を扱う",
                "failure":"外部処理との途中状態を保存し、重複処理せず再開できる",
                "reliability":"アプリ1台の停止後60秒以内、単一地域の停止後5分以内に受付を再開",
                "data":"取引記録と変更履歴を5年保存"
            }),
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
        if self.custom_mode == Some(CustomMode::SelfDefined) {
            return "設計ファシリテーターとして、利用者が書いた仕様だけを既知の条件として扱う。未記載の条件を発注者の決定事項として創作せず、利用者・負荷・保存・応答・故障・権限・予算・運用のうち必要な観点を質問し、利用者自身が決められるようにする。";
        }
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

fn condition_label(id: &str) -> &str {
    match id {
        "users" => "利用者と利用時間",
        "traffic" => "利用量と集中する時間",
        "response" => "応答時間",
        "delivery" => "届けるまでの時間",
        "freshness" => "情報の新しさ",
        "availability" => "停止できる時間",
        "reliability" => "故障時の継続・復旧",
        "failure" => "外部処理の失敗",
        "overload" => "混雑時の扱い",
        "offline" => "通信切断中の扱い",
        "reconnect" => "再接続",
        "presence" => "オンライン状態",
        "data" => "記録の保存と正しさ",
        "storage" => "保存量と期間",
        "consistency" => "重複・矛盾の防止",
        "access" => "権限と公開範囲",
        "deletion" => "削除の反映",
        "operations" => "運用体制",
        "budget" => "予算",
        _ => "その他の条件",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn custom(
        mode: CustomMode,
        family: Option<ScenarioFamily>,
        difficulty: Option<Difficulty>,
    ) -> Scenario {
        Scenario {
            id: "custom".into(),
            title: "予約サービス".into(),
            description: "利用者が席を予約する".into(),
            is_custom: true,
            difficulty,
            partner_role: Some(PartnerRole::Cto),
            custom_mode: Some(mode),
            scenario_family: family,
        }
    }

    #[test]
    fn guided_custom_requires_a_family_and_level() {
        assert!(
            custom(
                CustomMode::Guided,
                Some(ScenarioFamily::Transaction),
                Some(Difficulty::Medium)
            )
            .validate()
        );
        assert!(!custom(CustomMode::Guided, None, Some(Difficulty::Medium)).validate());
        assert!(!custom(CustomMode::Guided, Some(ScenarioFamily::Transaction), None).validate());
    }

    #[test]
    fn self_defined_has_no_hidden_profile() {
        let scenario = custom(CustomMode::SelfDefined, None, None);
        assert!(scenario.validate());
        assert_eq!(scenario.requirements()["hiddenRequirements"], "なし");
        assert!(scenario.partner_instruction().contains("創作せず"));
    }

    #[test]
    fn family_and_level_select_stable_requirements() {
        let scenario = custom(
            CustomMode::Guided,
            Some(ScenarioFamily::Transaction),
            Some(Difficulty::Medium),
        );
        assert_eq!(scenario.requirements()["users"], "10万 DAU");
        assert!(
            scenario.requirements()["consistency"]
                .as_str()
                .unwrap()
                .contains("二重")
        );
        let catalog = scenario.condition_catalog();
        assert!(catalog.iter().any(|item| item.id == "consistency"));
        assert_eq!(
            catalog
                .iter()
                .find(|item| item.id == "users")
                .unwrap()
                .label,
            "利用者と利用時間"
        );
    }
}
