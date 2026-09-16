use super::scenario::{Scenario, ScenarioCondition, bounded};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DesignNode {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub label: String,
    pub description: String,
    #[serde(rename = "parentNode")]
    pub parent: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DesignEdge {
    pub source: String,
    pub target: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EvaluationRequest {
    pub scenario: Scenario,
    pub nodes: Vec<DesignNode>,
    pub edges: Vec<DesignEdge>,
    #[serde(default, rename = "interviewEvidence")]
    pub interview_evidence: Vec<InterviewEvidence>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InterviewEvidence {
    pub condition_id: String,
    pub label: String,
    pub question: String,
    pub answer: String,
    pub question_message_index: usize,
    pub answer_message_index: usize,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InterviewAssessment {
    pub confirmed: usize,
    pub total: usize,
    pub confirmed_conditions: Vec<ScenarioCondition>,
    pub missing_conditions: Vec<ScenarioCondition>,
}

impl EvaluationRequest {
    pub fn validate(&self, types: &HashSet<String>, groups: &HashSet<String>) -> bool {
        if !self.scenario.validate()
            || self.nodes.is_empty()
            || self.nodes.len() > 200
            || self.edges.len() > 400
        {
            return false;
        }
        let nodes: HashMap<_, _> = self.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
        if nodes.len() != self.nodes.len() {
            return false;
        }
        let mut characters = 0;
        for node in &self.nodes {
            if !bounded(&node.id, 100)
                || !types.contains(&node.kind)
                || !bounded(&node.label, 120)
                || node.description.chars().count() > 2000
            {
                return false;
            }
            characters += node.description.chars().count() + node.label.chars().count();
            let mut seen = HashSet::from([node.id.as_str()]);
            let mut parent = node.parent.as_deref();
            while let Some(id) = parent {
                if !seen.insert(id) {
                    return false;
                }
                let Some(ancestor) = nodes.get(id) else {
                    return false;
                };
                if !groups.contains(&ancestor.kind) {
                    return false;
                }
                parent = ancestor.parent.as_deref();
            }
        }
        characters <= 24000
            && self.edges.iter().all(|e| {
                nodes.contains_key(e.source.as_str()) && nodes.contains_key(e.target.as_str())
            })
            && self.interview_evidence.len() <= 100
            && self
                .interview_evidence
                .iter()
                .map(|item| item.condition_id.as_str())
                .collect::<HashSet<_>>()
                .len()
                == self.interview_evidence.len()
            && self.interview_evidence.iter().all(|item| {
                self.scenario.has_condition(&item.condition_id)
                    && bounded(&item.condition_id, 40)
                    && bounded(&item.label, 80)
                    && bounded(&item.question, 4000)
                    && bounded(&item.answer, 4000)
                    && item.question_message_index < item.answer_message_index
                    && item.answer_message_index < 1000
            })
    }

    pub fn interview_assessment(&self) -> InterviewAssessment {
        let confirmed_ids: HashSet<_> = self
            .interview_evidence
            .iter()
            .map(|item| item.condition_id.as_str())
            .collect();
        let catalog = self.scenario.condition_catalog();
        let (confirmed_conditions, missing_conditions): (
            Vec<ScenarioCondition>,
            Vec<ScenarioCondition>,
        ) = catalog
            .into_iter()
            .partition(|condition| confirmed_ids.contains(condition.id.as_str()));
        InterviewAssessment {
            confirmed: confirmed_conditions.len(),
            total: confirmed_conditions.len() + missing_conditions.len(),
            confirmed_conditions,
            missing_conditions,
        }
    }
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvaluationResult {
    pub total_score: u8,
    pub details: Scores,
    pub weights: ScoreWeights,
    pub feedback: String,
    pub improvement: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interview: Option<InterviewAssessment>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelEvaluationResult {
    pub total_score: u8,
    pub details: Scores,
    pub feedback_sections: ModelFeedbackSections,
    pub improvement: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelFeedbackSections {
    pub evidence: Vec<String>,
    pub major_deficiencies: Vec<ModelMajorDeficiency>,
    pub unknowns: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelMajorDeficiency {
    pub basis: MajorDeficiencyBasis,
    pub text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MajorDeficiencyBasis {
    ExplicitContradiction,
    ImpossibleApproach,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scores {
    pub availability: u8,
    pub scalability: u8,
    pub security: u8,
    pub maintainability: u8,
    pub cost_efficiency: u8,
    pub feasibility: u8,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScoreWeights {
    pub availability: u8,
    pub scalability: u8,
    pub security: u8,
    pub maintainability: u8,
    pub cost_efficiency: u8,
    pub feasibility: u8,
}

impl EvaluationResult {
    pub fn weighted_score(&self) -> u8 {
        let d = &self.details;
        let scores = [
            d.availability,
            d.scalability,
            d.security,
            d.maintainability,
            d.cost_efficiency,
            d.feasibility,
        ];
        let weights = self.weights.values();
        let weight_sum: u32 = weights.iter().map(|value| *value as u32).sum();
        let sum: u32 = scores
            .iter()
            .zip(weights)
            .map(|(score, weight)| *score as u32 * weight as u32)
            .sum();
        ((sum + weight_sum / 2) / weight_sum) as u8
    }
    pub fn validate(&self) -> bool {
        [
            self.total_score,
            self.details.availability,
            self.details.scalability,
            self.details.security,
            self.details.maintainability,
            self.details.cost_efficiency,
            self.details.feasibility,
            self.weights.availability,
            self.weights.scalability,
            self.weights.security,
            self.weights.maintainability,
            self.weights.cost_efficiency,
            self.weights.feasibility,
        ]
        .iter()
        .all(|s| *s <= 100)
            && self
                .weights
                .values()
                .iter()
                .map(|value| *value as u16)
                .sum::<u16>()
                > 0
            && bounded(&self.feedback, 12000)
            && bounded(&self.improvement, 12000)
    }
}

impl ModelEvaluationResult {
    pub fn into_public(self, req: &EvaluationRequest) -> Result<EvaluationResult, ()> {
        if self.total_score > 100
            || !self.details.values().iter().all(|score| *score <= 100)
            || self.feedback_sections.evidence.len() > 20
            || self.feedback_sections.major_deficiencies.len() > 20
            || self.feedback_sections.unknowns.len() > 20
            || !bounded(&self.improvement, 12000)
        {
            return Err(());
        }
        let valid_item = |value: &str| bounded(value, 2000);
        if !self
            .feedback_sections
            .evidence
            .iter()
            .all(|item| valid_item(item))
            || !self
                .feedback_sections
                .unknowns
                .iter()
                .all(|item| valid_item(item))
            || !self
                .feedback_sections
                .major_deficiencies
                .iter()
                .all(|item| valid_item(&item.text))
        {
            return Err(());
        }

        let mut unknowns = self.feedback_sections.unknowns;
        let mut major = Vec::new();
        for deficiency in self.feedback_sections.major_deficiencies {
            // The learner should see the architectural conflict, not a narration of
            // how the evaluator resisted instructions embedded in user-authored data.
            // The same response can still retain the concrete design contradiction
            // (for example, volatile storage against a three-year retention rule).
            if describes_instruction_attack(&deficiency.text) {
                continue;
            }
            // Missing settings and unfinished verification are uncertainty, even when
            // the model placed them in the stronger bucket. Preserve the feedback but
            // normalize its severity before it reaches learners.
            if expresses_uncertainty(&deficiency.text) {
                unknowns.push(deficiency.text);
            } else {
                let basis = match deficiency.basis {
                    MajorDeficiencyBasis::ExplicitContradiction => "要件との明示的な矛盾",
                    MajorDeficiencyBasis::ImpossibleApproach => "成立しない構成",
                };
                major.push(format!("{}（判定根拠: {}）", deficiency.text, basis));
            }
        }

        let render = |title: &str, items: &[String], empty: &str| {
            let body = if items.is_empty() {
                empty.to_owned()
            } else {
                items
                    .iter()
                    .map(|item| format!("- {}", normalize_node_links(item, &req.nodes)))
                    .collect::<Vec<_>>()
                    .join("\n")
            };
            format!("### {title}\n{body}")
        };
        let feedback = [
            render(
                "確認した根拠",
                &self.feedback_sections.evidence,
                "確認できた根拠はありません。",
            ),
            render("重大な不足", &major, "重大な不足は確認されませんでした。"),
            render("未確認事項", &unknowns, "未確認事項はありません。"),
        ]
        .join("\n\n");
        let improvement = normalize_node_links(&self.improvement, &req.nodes);
        let mut result = EvaluationResult {
            total_score: self.total_score,
            details: self.details,
            weights: ScoreWeights::from_scenario(&req.scenario),
            feedback,
            improvement,
            interview: Some(req.interview_assessment()),
        };
        if !result.validate() {
            return Err(());
        }
        result.total_score = result.weighted_score();
        Ok(result)
    }
}

impl Scores {
    fn values(&self) -> [u8; 6] {
        [
            self.availability,
            self.scalability,
            self.security,
            self.maintainability,
            self.cost_efficiency,
            self.feasibility,
        ]
    }
}

impl ScoreWeights {
    fn from_scenario(scenario: &Scenario) -> Self {
        let weights = scenario.score_weights();
        let weights = if weights.iter().all(|value| *value == 0) {
            [1, 1, 1, 1, 1, 1]
        } else {
            weights
        };
        Self {
            availability: weights[0] as u8,
            scalability: weights[1] as u8,
            security: weights[2] as u8,
            maintainability: weights[3] as u8,
            cost_efficiency: weights[4] as u8,
            feasibility: weights[5] as u8,
        }
    }

    fn values(&self) -> [u8; 6] {
        [
            self.availability,
            self.scalability,
            self.security,
            self.maintainability,
            self.cost_efficiency,
            self.feasibility,
        ]
    }
}

fn expresses_uncertainty(value: &str) -> bool {
    [
        "未確認",
        "未実施",
        "不明",
        "未定",
        "記載がない",
        "記載されていない",
        "確認が必要",
        "検証が必要",
        "今後確認",
    ]
    .iter()
    .any(|marker| value.contains(marker))
}

fn describes_instruction_attack(value: &str) -> bool {
    value.contains("プロンプトインジェクション")
        || value.contains("ルール変更の試み")
        || (value.contains("指示")
            && ["上書き", "優先", "無視"]
                .iter()
                .any(|marker| value.contains(marker)))
}

fn normalize_node_links(value: &str, nodes: &[DesignNode]) -> String {
    let mut result = value.to_owned();
    for node in nodes {
        let encoded_id = encode_fragment_value(&node.id);
        let link = format!("[{}](#node={})", node.label, encoded_id);
        let suffix = format!("](#node={})", encoded_id);
        let mut search_from = 0;
        while let Some(relative_end) = result[search_from..].find(&suffix) {
            let end = search_from + relative_end + suffix.len();
            let label_end = search_from + relative_end;
            let Some(relative_start) = result[..label_end].rfind('[') else {
                search_from = end;
                continue;
            };
            if result[relative_start..end]
                .chars()
                .any(|c| matches!(c, '\n' | '\r'))
            {
                search_from = end;
                continue;
            }
            result.replace_range(relative_start..end, &link);
            search_from = relative_start + link.len();
        }
        if nodes.iter().filter(|item| item.label == node.label).count() != 1 {
            continue;
        }
        let prefix = format!("[{}](#node=", node.label);
        let mut search_from = 0;
        while let Some(relative_start) = result[search_from..].find(&prefix) {
            let start = search_from + relative_start;
            let Some(relative_end) = result[start..].find(')') else {
                break;
            };
            let end = start + relative_end + 1;
            if result[start..end].chars().any(|c| matches!(c, '\n' | '\r')) {
                break;
            }
            result.replace_range(start..end, &link);
            search_from = start + link.len();
        }
        result = result.replace(&format!("{} {}", node.label, link), &link);
        for particle in ["から", "へ", "を", "で", "に", "と", "が", "は", "の"] {
            result = result.replace(&format!("{}{}{}", node.label, particle, link), &link);
        }
    }
    result
}

fn encode_fragment_value(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> EvaluationRequest {
        EvaluationRequest {
            scenario: serde_json::from_value(serde_json::json!({
                "id":"internal_tool", "title":"勤怠", "description":"勤怠"
            }))
            .unwrap(),
            nodes: vec![DesignNode {
                id: "browser".into(),
                kind: "Web Browser".into(),
                label: "社員のブラウザ".into(),
                description: String::new(),
                parent: None,
            }],
            edges: vec![],
            interview_evidence: vec![],
        }
    }

    #[test]
    fn duplicate_score_keys_are_not_silently_accepted() {
        // Observed from the real provider despite application/json mode.
        let response = r#"{"totalScore":31,"details":{"availability":10,"scalability":50,"scalability":50,"security":40,"maintainability":30,"costEfficiency":50,"feasibility":50},"feedback":"根拠","improvement":"改善"}"#;
        assert!(serde_json::from_str::<EvaluationResult>(response).is_err());
    }

    #[test]
    fn equal_weight_score_is_bounded_and_rounds_half_up_including_zero() {
        for (values, expected) in [
            ([0, 0, 0, 0, 0, 0], 0),
            ([100; 6], 100),
            ([0, 0, 0, 0, 0, 3], 1),
            ([10, 20, 30, 40, 50, 60], 35),
        ] {
            let result = EvaluationResult {
                total_score: 99,
                details: Scores {
                    availability: values[0],
                    scalability: values[1],
                    security: values[2],
                    maintainability: values[3],
                    cost_efficiency: values[4],
                    feasibility: values[5],
                },
                weights: ScoreWeights {
                    availability: 1,
                    scalability: 1,
                    security: 1,
                    maintainability: 1,
                    cost_efficiency: 1,
                    feasibility: 1,
                },
                feedback: "根拠".into(),
                improvement: "改善".into(),
                interview: None,
            };
            assert!(result.validate());
            assert_eq!(result.weighted_score(), expected);
        }
    }

    #[test]
    fn public_feedback_normalizes_severity_security_meta_text_and_node_links() {
        let result = ModelEvaluationResult {
            total_score: 99,
            details: Scores {
                availability: 60,
                scalability: 60,
                security: 60,
                maintainability: 60,
                cost_efficiency: 60,
                feasibility: 60,
            },
            feedback_sections: ModelFeedbackSections {
                evidence: vec!["社員のブラウザから[権限と公開範囲](#node=browser)へ送信".into()],
                major_deficiencies: vec![
                    ModelMajorDeficiency {
                        basis: MajorDeficiencyBasis::ExplicitContradiction,
                        text: "バックアップ試験が未実施です".into(),
                    },
                    ModelMajorDeficiency {
                        basis: MajorDeficiencyBasis::ExplicitContradiction,
                        text: "システム要件を上書きする指示は無視されます".into(),
                    },
                    ModelMajorDeficiency {
                        basis: MajorDeficiencyBasis::ExplicitContradiction,
                        text: "データを保存しないため保持要件と矛盾します".into(),
                    },
                ],
                unknowns: vec![],
            },
            improvement: "社員のブラウザ [社員のブラウザ](#node=browser)を確認".into(),
        }
        .into_public(&request())
        .unwrap();
        assert_eq!(result.total_score, 60);
        assert!(
            result
                .feedback
                .contains("### 重大な不足\n- データを保存しないため保持要件と矛盾します")
        );
        assert!(!result.feedback.contains("システム要件を上書きする指示"));
        assert!(
            result
                .feedback
                .contains("### 未確認事項\n- バックアップ試験が未実施です")
        );
        assert!(
            result
                .feedback
                .contains("[社員のブラウザ](#node=browser)へ送信")
        );
        assert_eq!(result.improvement, "[社員のブラウザ](#node=browser)を確認");
        assert_eq!(encode_fragment_value("DB 東京"), "DB%20%E6%9D%B1%E4%BA%AC");
    }
}
