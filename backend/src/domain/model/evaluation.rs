use super::scenario::{Scenario, bounded};
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
}

impl EvaluationRequest {
    pub fn validate(&self, types: &HashSet<String>) -> bool {
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
                parent = ancestor.parent.as_deref();
            }
        }
        characters <= 24000
            && self.edges.iter().all(|e| {
                nodes.contains_key(e.source.as_str()) && nodes.contains_key(e.target.as_str())
            })
    }
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvaluationResult {
    pub total_score: u8,
    pub details: Scores,
    pub feedback: String,
    pub improvement: String,
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
