use super::scenario::{Scenario, bounded};
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
