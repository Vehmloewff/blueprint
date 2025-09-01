use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn deserialize_string(value: &serde_json::Value, path: &str) -> Result<String, String> {
	match value {
		serde_json::Value::String(s) => Ok(s.clone()),
		_ => Err(format!("failed to deserialize into string at {}: value is not a string", path)),
	}
}



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

	pub fn serialize(&self) -> Result<serde_json::Value, serde_json::Error> {
		serde_json::to_value(self)
	}

	pub fn deserialize(value: &serde_json::Value, path: &str) -> Result<Self, String> {
		let base_error_message = format!("failed to deserialize into '{}' at '{}'", "message_intent", path);

		if !value.is_object() {
			return Err(format!("{}: value is not an object", base_error_message));
		}

		let obj = value.as_object().unwrap();

		if obj.contains_key("create") {
			Ok(MessageIntent::Create)
		}
		else if obj.contains_key("delete") {
			Ok(MessageIntent::Delete)
		}
		else {
			Err(format!("{}: value does not contain any recognized variants", base_error_message))
		}
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
	pub fn with_intent(mut self, intent: impl IntoMessageIntent) -> Self {
		self.intent = Some(MessageIntent::from(intent));
		self
	}

	pub fn serialize(&self) -> Result<serde_json::Value, serde_json::Error> {
		serde_json::to_value(self)
	}

	pub fn deserialize(value: &serde_json::Value, path: &str) -> Result<Self, String> {
		let base_error_message = format!("failed to deserialize into '{}' at '{}'", "message", path);

		if !value.is_object() {
			return Err(format!("{}: value is not an object", base_error_message));
		}

		let obj = value.as_object().unwrap();

		if !obj.contains_key("id") {
			return Err(format!("{}: value does not contain required field 'id'", base_error_message));
		}
		let mut result = Self::new(deserialize_string(&obj["id"], &format!("{}/{}", path, "id"))?);

		if let Some(value) = obj.get("intent") {
			result.intent = Some(MessageIntent::deserialize(&value, &format!("{}/{}", path, "intent"))?);
		}

		Ok(result)
	}
}

