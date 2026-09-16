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
    pub feedback: String,
    pub improvement: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interview: Option<InterviewAssessment>,
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

impl EvaluationResult {
    pub fn mean_score(&self) -> u8 {
        let d = &self.details;
        let sum: u16 = [
            d.availability,
            d.scalability,
            d.security,
            d.maintainability,
            d.cost_efficiency,
            d.feasibility,
        ]
        .iter()
        .map(|value| *value as u16)
        .sum();
        ((sum + 3) / 6) as u8
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
        ]
        .iter()
        .all(|s| *s <= 100)
            && bounded(&self.feedback, 12000)
            && bounded(&self.improvement, 12000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_score_keys_are_not_silently_accepted() {
        // Observed from the real provider despite application/json mode.
        let response = r#"{"totalScore":31,"details":{"availability":10,"scalability":50,"scalability":50,"security":40,"maintainability":30,"costEfficiency":50,"feasibility":50},"feedback":"根拠","improvement":"改善"}"#;
        assert!(serde_json::from_str::<EvaluationResult>(response).is_err());
    }

    #[test]
    fn mean_is_bounded_and_rounds_half_up_including_zero() {
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
                feedback: "根拠".into(),
                improvement: "改善".into(),
                interview: None,
            };
            assert!(result.validate());
            assert_eq!(result.mean_score(), expected);
        }
    }
}
