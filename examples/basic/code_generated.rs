use serde::{Deserialize, Serialize};



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
		Self {
			id,
			intent: None,
		}
	}

	/// The id of the message that can be sent
	pub fn with_id(mut self, id: String) -> Self {
		self.id = id;
		self
	}

	/// The intention of the message. Should be present unless it is a ping.
	pub fn with_intent(mut self, intent: impl Into<MessageIntent>) -> Self {
		self.intent = Some(intent.into());
		self
	}

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

