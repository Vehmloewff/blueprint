use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Trait for types that can convert into MessageIntent
pub trait IntoMessageIntent {
    fn into_message_intent(self) -> MessageIntent;
}

/// Message intents are the primary way to categorize messages.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageIntent {
    /// Create a new entity
    #[serde(rename = "create")]
    Create,
    /// Delete an entity
    #[serde(rename = "delete")]
    Delete,
}

impl MessageIntent {
    pub fn from<T: IntoMessageIntent>(thing: T) -> Self {
        thing.into_message_intent()
    }

    /// Create a new entity
    pub fn create() -> Self {
        MessageIntent::Create
    }

    /// Delete an entity
    pub fn delete() -> Self {
        MessageIntent::Delete
    }
}

/// A message that can be sent between processes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// The id of the message that can be sent
    #[serde(rename = "id")]
    pub id: String,
    /// The intention of the message. Should be present unless it is a ping.
    #[serde(rename = "intent")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intent: Option<MessageIntent>,
}

impl Message {
    /// A message that can be sent between processes
    pub fn new(id: String) -> Self {
        Self { id, intent: None }
    }

    /// The id of the message that can be sent
    pub fn with_id(mut self, id: String) -> Self {
        self.id = id;
        self
    }

    /// The intention of the message. Should be present unless it is a ping.
    pub fn with_intent(mut self, intent: impl IntoMessageIntent) -> Self {
        self.intent = Some(MessageIntent::from(intent));
        self
    }
}
