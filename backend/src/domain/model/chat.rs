use super::scenario::{Scenario, ScenarioCondition, bounded};
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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub reply: String,
    pub covered_conditions: Vec<ScenarioCondition>,
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
            || self
                .covered_condition_ids
                .iter()
                .any(|id| !bounded(id, 40) || !scenario.has_condition(id))
        {
            return Err(());
        }
        let mut seen = std::collections::HashSet::new();
        let catalog = scenario.condition_catalog();
        let covered_conditions = self
            .covered_condition_ids
            .into_iter()
            .filter(|id| seen.insert(id.clone()))
            .filter_map(|id| catalog.iter().find(|item| item.id == id).cloned())
            .collect();
        Ok(ChatResponse {
            reply: self.reply,
            covered_conditions,
        })
    }
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
        }
        .into_public(&scenario())
        .unwrap();
        assert_eq!(valid.covered_conditions.len(), 1);
        assert_eq!(valid.covered_conditions[0].label, "利用者と利用時間");
        assert!(
            ModelChatResponse {
                reply: "任意の条件".into(),
                covered_condition_ids: vec!["invented".into()],
            }
            .into_public(&scenario())
            .is_err()
        );
    }
}
