use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioCondition {
    pub id: String,
    pub label: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NegotiationProposal {
    pub option_id: String,
    pub condition_id: String,
    pub label: String,
    pub current_value: String,
    pub proposed_value: String,
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
    pub profile_id: Option<ScenarioProfile>,
    #[serde(default)]
    pub accepted_negotiation_ids: Vec<String>,
    #[serde(default = "default_specification_version")]
    pub specification_version: u16,
}

fn default_specification_version() -> u16 {
    1
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

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ScenarioProfile {
    AttendanceOffice,
    AttendanceShift,
    AttendanceField,
    SnsPrivateCommunity,
    SnsPhotoDiscovery,
    SnsLiveEvent,
}

pub fn bounded(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.chars().count() <= max
}

#[derive(Clone, Copy)]
struct NegotiationOption {
    id: &'static str,
    condition_id: &'static str,
    revised_value: &'static str,
}

impl ScenarioProfile {
    fn matches(self, scenario_id: &str) -> bool {
        matches!(
            (scenario_id, self),
            (
                "internal_tool",
                Self::AttendanceOffice | Self::AttendanceShift | Self::AttendanceField
            ) | (
                "sns_app",
                Self::SnsPrivateCommunity | Self::SnsPhotoDiscovery | Self::SnsLiveEvent
            )
        )
    }
}

impl Scenario {
    fn profile_requirements(&self) -> Value {
        match self.profile_id.expect("profile checked by caller") {
            ScenarioProfile::AttendanceOffice => json!({
                "users":"社員50人。出勤・退勤は最大100打刻/営業日。社員は自分の記録を確認し、人事2人が月次CSVを出す",
                "traffic":"40人が始業前5分に出勤。平均0.13件/秒、最も重なる1秒は5件",
                "response":"打刻の受付結果は2秒以内。月次CSVは依頼から5分以内",
                "availability":"平日9〜18時を優先。アプリ1台の停止は営業時間中1時間以内、夜間停止は1回30分まで",
                "data":"打刻を3年保存し、保存確認後に受付完了とする。受付済み記録をアプリ1台の停止で失わず、訂正前の値と担当者を残す",
                "access":"社員は自分、人事2人は全員の記録を閲覧できる",
                "operations":"兼任1人で運用し、定常作業は週1時間以内を希望",
                "budget":"月1万円を目標"
            }),
            ScenarioProfile::AttendanceShift => json!({
                "users":"工場の社員3,000人が24時間利用。休憩を含め最大12,000打刻/日",
                "traffic":"交代時に2,400人が2分で打刻。平均20件/秒、最も重なる1秒は100件",
                "response":"打刻の受付結果は1秒以内。日次集計は翌朝6時まで",
                "reliability":"アプリ1台が停止しても60秒以内に受付を再開し、応答がない操作は再試行できる",
                "data":"打刻を3年保存し、受付済み記録を失わない。再送しても同じ打刻を二重に記録しない",
                "access":"責任者は担当部署、人事は全体を閲覧できる",
                "operations":"運用担当2人。深夜の手作業による台数調整を避ける",
                "budget":"月20万円を目標"
            }),
            ScenarioProfile::AttendanceField => json!({
                "users":"訪問業務の社員500人、20拠点。最大2,000打刻/日",
                "traffic":"復旧時は最大2,000件を5分以内に同期。平均6.7件/秒、初期最大50件/秒",
                "response":"オンライン受付は2秒以内、オフライン仮保存は1秒以内",
                "offline":"通信断または中央停止が30分続いても同じ端末へ仮保存し、復旧後または次回起動から5分以内に同期",
                "data":"仮保存と中央受付を区別し、再送の二重計上を防ぐ。打刻時刻と到着時刻、訂正履歴を残し、中央の記録は3年保存",
                "access":"社員は自分、責任者は担当拠点、人事は全体を閲覧できる",
                "operations":"運用担当2人。未同期の状態を確認でき、日次集計は翌日でよい",
                "budget":"月5万円を目標"
            }),
            ScenarioProfile::SnsPrivateCommunity => json!({
                "users":"会員1,000 DAU、100投稿/日、一覧1万回/日",
                "traffic":"活動後5分は一覧20回/秒、投稿は最大2件/秒",
                "response":"一覧データ1秒以内、先頭10枚は3秒以内、投稿受付はアップロード後2秒以内",
                "freshness":"投稿は60秒以内に会員の一覧へ反映",
                "storage":"平均2MBの元画像と投稿を1年保存。削除後は新規閲覧を拒否し、物理削除は24時間以内",
                "reliability":"受付済み投稿をアプリ1台の停止で失わず、8〜20時は2時間以内、時間外は翌朝10時までに復旧",
                "access":"招待会員だけが閲覧・投稿でき、URLを知る非会員にも画像を返さない",
                "operations":"兼任1人で運用。動画・DM・推薦は対象外",
                "budget":"月2万円を目標"
            }),
            ScenarioProfile::SnsPhotoDiscovery => json!({
                "users":"100万 DAU。日本40%、北米30%、欧州30%。10万投稿/日、一覧1,000万回/日",
                "traffic":"15分間に一覧2,000回/秒、投稿60件/秒。元画像は平均2MB",
                "response":"各地域で一覧データ1秒以内、先頭10枚は2秒以内、投稿受付はアップロード後2秒以内",
                "freshness":"投稿は30秒以内、いいね数は60秒以内に反映",
                "storage":"元画像と投稿を1年保存。元画像だけで約73TB/年。閲覧用軽量画像を別に持てる",
                "reliability":"24時間利用。アプリ1台の停止後60秒以内に閲覧を再開し、受付済み投稿を失わない",
                "access":"投稿・削除は本人だけ。削除後60秒以内に一覧と画像配信の新規閲覧を拒否",
                "operations":"運用担当6人。ランキングは日次、推薦AIと動画は対象外",
                "budget":"月3,000万円を目標"
            }),
            ScenarioProfile::SnsLiveEvent => json!({
                "users":"イベント参加者10万 DAU、2万投稿/日、一覧200万回/日。対象地域は日本",
                "traffic":"発表直後1分間に一覧2万回/秒、投稿100件/秒",
                "response":"一覧データ0.5秒以内、先頭10枚は3秒以内、投稿受付はアップロード後1秒以内",
                "freshness":"受付済み投稿は2秒以内、いいね数は30秒以内に反映",
                "storage":"平均2MBの元画像と投稿を30日保存し、期間後に消えることを利用者へ示す",
                "reliability":"アプリ1台の停止後60秒以内に受付を再開し、受付済み投稿を失わない",
                "overload":"処理不能時は受付前に待機・再試行を案内し、成功したように見せて捨てない",
                "data":"再送で同じ投稿を二重に作らず、投稿・削除は本人だけ。削除は60秒以内に反映",
                "operations":"運用担当3人。開催中は対応し、イベント外は予定した1時間の夜間停止を許容",
                "budget":"月500万円を目標"
            }),
        }
    }

    fn negotiation_options(&self) -> &'static [NegotiationOption] {
        match self.profile_id {
            Some(ScenarioProfile::AttendanceOffice) => &[
                NegotiationOption {
                    id: "attendance-office-budget-20k",
                    condition_id: "budget",
                    revised_value: "運用負担を減らせる根拠があれば月2万円まで許容",
                },
                NegotiationOption {
                    id: "attendance-office-csv-next-day",
                    condition_id: "response",
                    revised_value: "打刻の受付結果は2秒以内。月次CSVは事前予約し翌営業日まででよい",
                },
            ],
            Some(ScenarioProfile::AttendanceShift) => &[
                NegotiationOption {
                    id: "attendance-shift-report-8am",
                    condition_id: "response",
                    revised_value: "打刻の受付結果は1秒以内。日次集計は翌朝8時まで",
                },
                NegotiationOption {
                    id: "attendance-shift-budget-300k",
                    condition_id: "budget",
                    revised_value: "故障対応と運用負担を改善する根拠があれば月30万円まで許容",
                },
            ],
            Some(ScenarioProfile::AttendanceField) => &[
                NegotiationOption {
                    id: "attendance-field-sync-15m",
                    condition_id: "offline",
                    revised_value: "未同期状態を本部に示せるなら、復旧後または次回起動から15分以内に同期",
                },
                NegotiationOption {
                    id: "attendance-field-budget-80k",
                    condition_id: "budget",
                    revised_value: "仮保存と同期の運用負担を減らす根拠があれば月8万円まで許容",
                },
            ],
            Some(ScenarioProfile::SnsPrivateCommunity) => &[
                NegotiationOption {
                    id: "sns-private-retention-90d",
                    condition_id: "storage",
                    revised_value: "費用を抑えるため元画像と投稿を90日保存。削除後は新規閲覧を拒否し、物理削除は24時間以内",
                },
                NegotiationOption {
                    id: "sns-private-budget-30k",
                    condition_id: "budget",
                    revised_value: "運用負担を減らせる根拠があれば月3万円まで許容",
                },
            ],
            Some(ScenarioProfile::SnsPhotoDiscovery) => &[
                NegotiationOption {
                    id: "sns-discovery-retention-180d",
                    condition_id: "storage",
                    revised_value: "元画像と投稿を180日保存。閲覧用軽量画像を別に持てる",
                },
                NegotiationOption {
                    id: "sns-discovery-freshness-60s",
                    condition_id: "freshness",
                    revised_value: "投稿は60秒以内、いいね数も60秒以内に反映",
                },
            ],
            Some(ScenarioProfile::SnsLiveEvent) => &[
                NegotiationOption {
                    id: "sns-event-likes-60s",
                    condition_id: "freshness",
                    revised_value: "受付済み投稿は2秒以内、いいね数は60秒以内に反映",
                },
                NegotiationOption {
                    id: "sns-event-budget-7m",
                    condition_id: "budget",
                    revised_value: "混雑時の受付と処理を改善する根拠があれば月700万円まで許容",
                },
            ],
            None => &[],
        }
    }

    pub fn available_negotiation_ids(&self) -> Vec<&'static str> {
        self.negotiation_options()
            .iter()
            .filter(|option| {
                !self
                    .accepted_negotiation_ids
                    .iter()
                    .any(|id| id == option.id)
            })
            .map(|option| option.id)
            .collect()
    }

    pub fn negotiation_context(&self) -> Value {
        Value::Array(
            self.available_negotiation_ids()
                .into_iter()
                .filter_map(|id| self.negotiation_proposal(id))
                .map(|proposal| {
                    json!({
                        "optionId": proposal.option_id,
                        "conditionId": proposal.condition_id,
                        "currentValue": proposal.current_value,
                        "proposedValue": proposal.proposed_value
                    })
                })
                .collect(),
        )
    }

    pub fn negotiation_proposal(&self, id: &str) -> Option<NegotiationProposal> {
        let option = self.negotiation_options().iter().find(|option| {
            option.id == id && !self.accepted_negotiation_ids.iter().any(|item| item == id)
        })?;
        Some(NegotiationProposal {
            option_id: option.id.to_owned(),
            condition_id: option.condition_id.to_owned(),
            label: condition_label(option.condition_id).to_owned(),
            current_value: self.condition_value(option.condition_id)?,
            proposed_value: option.revised_value.to_owned(),
        })
    }

    pub fn score_weights(&self) -> [u16; 6] {
        match self.profile_id {
            Some(ScenarioProfile::AttendanceOffice) => [35, 5, 20, 20, 20, 0],
            Some(ScenarioProfile::AttendanceShift) => [75, 15, 0, 10, 0, 0],
            Some(ScenarioProfile::AttendanceField) => [70, 0, 20, 10, 0, 0],
            Some(ScenarioProfile::SnsPrivateCommunity) => [15, 10, 30, 20, 25, 0],
            Some(ScenarioProfile::SnsPhotoDiscovery) => [20, 55, 0, 0, 25, 0],
            Some(ScenarioProfile::SnsLiveEvent) => [30, 70, 0, 0, 0, 0],
            None => [0; 6],
        }
    }
    pub fn validate(&self) -> bool {
        let negotiations_valid = self.accepted_negotiation_ids.len() <= 10
            && self.specification_version as usize == self.accepted_negotiation_ids.len() + 1
            && self
                .accepted_negotiation_ids
                .iter()
                .all(|id| bounded(id, 80))
            && self
                .accepted_negotiation_ids
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
                == self.accepted_negotiation_ids.len()
            && self.accepted_negotiation_ids.iter().all(|id| {
                self.negotiation_options()
                    .iter()
                    .any(|option| option.id == id)
            });
        bounded(&self.title, 120)
            && self.description.chars().count() <= 2000
            && negotiations_valid
            && match self.id.as_str() {
                "internal_tool" | "sns_app" => {
                    !self.is_custom
                        && self.difficulty.is_none()
                        && self.custom_mode.is_none()
                        && self.scenario_family.is_none()
                        && self
                            .profile_id
                            .is_none_or(|profile| profile.matches(self.id.as_str()))
                }
                "custom" => {
                    self.is_custom
                        && bounded(&self.description, 2000)
                        && self.profile_id.is_none()
                        && self.accepted_negotiation_ids.is_empty()
                        && self.specification_version == 1
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
        let mut requirements = match self.id.as_str() {
            "internal_tool" | "sns_app" if self.profile_id.is_some() => self.profile_requirements(),
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
        };
        if let Value::Object(values) = &mut requirements {
            for accepted in &self.accepted_negotiation_ids {
                if let Some(option) = self
                    .negotiation_options()
                    .iter()
                    .find(|option| option.id == accepted)
                {
                    values.insert(option.condition_id.to_owned(), json!(option.revised_value));
                }
            }
        }
        requirements
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
        let profile = match self.profile_id {
            Some(ScenarioProfile::AttendanceOffice) => Some("50人の会社で、無理なく運用する"),
            Some(ScenarioProfile::AttendanceShift) => Some("工場の交代時に、打刻が一斉に集中する"),
            Some(ScenarioProfile::AttendanceField) => {
                Some("訪問先で電波が切れても、出退勤を記録する")
            }
            Some(ScenarioProfile::SnsPrivateCommunity) => {
                Some("招待した仲間だけで、写真を共有する")
            }
            Some(ScenarioProfile::SnsPhotoDiscovery) => {
                Some("世界中から、写真を気持ちよく閲覧する")
            }
            Some(ScenarioProfile::SnsLiveEvent) => Some("イベント中の写真とコメントを、すぐ届ける"),
            None => None,
        };
        match self.id.as_str() {
            "internal_tool" => {
                json!({"title":"社内勤怠管理システム", "description":"社員が出退勤を記録するシステム", "case":profile, "specificationVersion":self.specification_version})
            }
            "sns_app" => {
                json!({"title":"画像投稿SNS", "description":"写真を投稿しタイムラインで閲覧するアプリ", "case":profile, "specificationVersion":self.specification_version})
            }
            _ => {
                json!({"title":self.title,"description":self.description,"specificationVersion":self.specification_version})
            }
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
            profile_id: None,
            accepted_negotiation_ids: vec![],
            specification_version: 1,
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

    #[test]
    fn fixed_profile_keeps_requirements_and_applies_only_known_negotiation() {
        let mut scenario: Scenario = serde_json::from_value(json!({
            "id":"internal_tool",
            "title":"勤怠",
            "description":"勤怠",
            "profileId":"attendance-shift"
        }))
        .unwrap();
        assert!(scenario.validate());
        assert_eq!(
            scenario.requirements()["traffic"],
            "交代時に2,400人が2分で打刻。平均20件/秒、最も重なる1秒は100件"
        );
        assert_eq!(scenario.score_weights(), [75, 15, 0, 10, 0, 0]);
        assert!(
            scenario
                .negotiation_proposal("attendance-shift-report-8am")
                .is_some()
        );

        scenario.accepted_negotiation_ids = vec!["attendance-shift-report-8am".into()];
        scenario.specification_version = 2;
        assert!(scenario.validate());
        assert!(
            scenario.requirements()["response"]
                .as_str()
                .unwrap()
                .contains("8時")
        );

        scenario.accepted_negotiation_ids = vec!["attendance-field-sync-15m".into()];
        assert!(!scenario.validate());
    }
}
