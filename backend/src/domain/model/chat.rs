use super::scenario::{NegotiationProposal, Scenario, ScenarioCondition, bounded};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    User,
    Model,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChatLog {
    pub role: ChatRole,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChatRequest {
    pub scenario: Scenario,
    pub messages: Vec<ChatLog>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelChatResponse {
    pub reply: String,
    pub covered_condition_ids: Vec<String>,
    #[serde(default)]
    pub negotiation_option_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub reply: String,
    pub covered_conditions: Vec<ScenarioCondition>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub negotiation_proposals: Vec<NegotiationProposal>,
}

impl ChatRequest {
    pub fn validate(&self) -> bool {
        self.scenario.validate()
            && !self.messages.is_empty()
            && self.messages.len() <= 100
            && self
                .messages
                .last()
                .is_some_and(|m| m.role == ChatRole::User)
            && self.messages.iter().all(|m| bounded(&m.content, 4000))
            && self
                .messages
                .iter()
                .map(|m| m.content.chars().count())
                .sum::<usize>()
                <= 24000
    }
}

impl ModelChatResponse {
    pub fn into_public(self, scenario: &Scenario) -> Result<ChatResponse, ()> {
        if !bounded(&self.reply, 4000)
            || self.covered_condition_ids.len() > 20
            || self.negotiation_option_ids.len() > 4
            || self
                .covered_condition_ids
                .iter()
                .any(|id| !bounded(id, 40) || !scenario.has_condition(id))
        {
            return Err(());
        }
        let available = scenario.available_negotiation_ids();
        if self
            .negotiation_option_ids
            .iter()
            .any(|id| !bounded(id, 80) || !available.iter().any(|item| item == id))
        {
            return Err(());
        }
        let mut covered_condition_ids = self.covered_condition_ids.clone();
        // Gemini can mention a condition while omitting its ID. Reconcile distinctive
        // fragments on the server so interview progress does not depend only on the
        // model's self-report. The catalog values never leave this process.
        for condition in scenario.condition_catalog() {
            if covered_condition_ids.iter().any(|id| id == &condition.id) {
                continue;
            }
            if scenario
                .condition_value(&condition.id)
                .is_some_and(|value| mentions_condition(&self.reply, &value))
            {
                covered_condition_ids.push(condition.id);
            }
        }
        let mut seen = std::collections::HashSet::new();
        let catalog = scenario.condition_catalog();
        let covered_conditions = covered_condition_ids
            .into_iter()
            .filter(|id| seen.insert(id.clone()))
            .filter_map(|id| catalog.iter().find(|item| item.id == id).cloned())
            .collect();
        let mut proposal_ids = std::collections::HashSet::new();
        let negotiation_proposals = self
            .negotiation_option_ids
            .into_iter()
            .filter(|id| proposal_ids.insert(id.clone()))
            .filter_map(|id| scenario.negotiation_proposal(&id))
            .collect();
        Ok(ChatResponse {
            reply: self.reply,
            covered_conditions,
            negotiation_proposals,
        })
    }
}

fn mentions_condition(reply: &str, value: &str) -> bool {
    let normalized_reply: String = reply.chars().filter(|c| c.is_alphanumeric()).collect();
    value
        .split(['、', '。', ',', '・'])
        .filter_map(|part| {
            let normalized: Vec<char> = part.chars().filter(|c| c.is_alphanumeric()).collect();
            (normalized.len() >= 5).then_some(normalized)
        })
        .any(|part| {
            let prefix: String = part.iter().take(5).collect();
            if normalized_reply.contains(&prefix) {
                return true;
            }
            part.iter()
                .position(|c| c.is_ascii_digit())
                .map(|digit| {
                    let start = digit.saturating_sub(1);
                    let end = (digit + 2).min(part.len());
                    part[start..end].iter().collect::<String>()
                })
                .filter(|cue| cue.chars().count() >= 3)
                .is_some_and(|cue| normalized_reply.contains(&cue))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scenario() -> Scenario {
        serde_json::from_value(serde_json::json!({
            "id":"internal_tool", "title":"勤怠", "description":"勤怠"
        }))
        .unwrap()
    }

    #[test]
    fn covered_conditions_must_come_from_the_server_catalog() {
        let valid = ModelChatResponse {
            reply: "社員50人です".into(),
            covered_condition_ids: vec!["users".into(), "users".into()],
            negotiation_option_ids: vec![],
        }
        .into_public(&scenario())
        .unwrap();
        assert_eq!(valid.covered_conditions.len(), 1);
        assert_eq!(valid.covered_conditions[0].label, "利用者と利用時間");
        assert!(
            ModelChatResponse {
                reply: "任意の条件".into(),
                covered_condition_ids: vec!["invented".into()],
                negotiation_option_ids: vec![],
            }
            .into_public(&scenario())
            .is_err()
        );
    }

    #[test]
    fn condition_mentioned_in_reply_is_reconciled_when_model_omits_id() {
        let response = ModelChatResponse {
            reply: "朝9時にみんなが一斉に打刻します。".into(),
            covered_condition_ids: vec![],
            negotiation_option_ids: vec![],
        }
        .into_public(&scenario())
        .unwrap();
        assert_eq!(response.covered_conditions.len(), 1);
        assert_eq!(response.covered_conditions[0].id, "traffic");
    }
}
