use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn deserialize_string(value: &serde_json::Value, path: &str) -> Result<String, String> {
	match value {
		serde_json::Value::String(s) => Ok(s.clone()),
		_ => Err(format!("failed to deserialize into string at {}: value is not a string", path)),
	}
}

fn deserialize_i32(value: &serde_json::Value, path: &str) -> Result<i32, String> {
	match value {
		serde_json::Value::Number(n) => {
			let i64_val = n.as_i64()
				.ok_or_else(|| format!("failed to deserialize into number at {}: invalid number", path))?;
			i64_val.try_into()
				.map_err(|_| format!("failed to deserialize into number at {}: number out of range", path))
		}
		_ => Err(format!("failed to deserialize into number at {}: value is not a number", path)),
	}
}

fn deserialize_f64(value: &serde_json::Value, path: &str) -> Result<f64, String> {
	match value {
		serde_json::Value::Number(n) => n.as_f64().ok_or_else(|| format!("failed to deserialize into number at {}: invalid number", path)),
		_ => Err(format!("failed to deserialize into number at {}: value is not a number", path)),
	}
}



/// This is the struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SomeStruct {
	/// This is foo
	#[serde(rename = "foo")]
	pub foo: String,
	/// This is the title
	#[serde(rename = "bar")]
	#[serde(skip_serializing_if = "Option::is_none")]
	pub bar: Option<i32>,
}

impl SomeStruct {
	/// This is the struct
	pub fn new(foo: String) -> Self {
		Self {
			foo,
			bar: None,
		}
	}

	/// This is foo
	pub fn with_foo(mut self, foo: String) -> Self {
		self.foo = foo;
		self
	}

	/// This is the title
	pub fn with_bar(mut self, bar: i32) -> Self {
		self.bar = Some(bar);
		self
	}

	pub fn serialize(&self) -> Result<serde_json::Value, serde_json::Error> {
		serde_json::to_value(self)
	}

	pub fn deserialize(value: &serde_json::Value, path: &str) -> Result<Self, String> {
		let base_error_message = format!("failed to deserialize into '{}' at '{}'", "some_struct", path);

		if !value.is_object() {
			return Err(format!("{}: value is not an object", base_error_message));
		}

		let obj = value.as_object().unwrap();

		if !obj.contains_key("foo") {
			return Err(format!("{}: value does not contain required field 'foo'", base_error_message));
		}
		let mut result = Self::new(deserialize_string(&obj["foo"], &format!("{}/{}", path, "foo"))?);

		if let Some(value) = obj.get("bar") {
			result.bar = Some(deserialize_i32(&value, &format!("{}/{}", path, "bar"))?);
		}

		Ok(result)
	}
}

impl IntoSomeEnum for SomeStruct {
	fn into_some_enum(self) -> SomeEnum {
		SomeEnum::option1(self)
	}
}



/// Trait for types that can convert into SomeEnum
pub trait IntoSomeEnum {
	fn into_some_enum(self) -> SomeEnum;
}

/// This is the enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SomeEnum {
	/// This is option 1
	#[serde(rename = "option1")]
	Option1(SomeStruct),
	/// This is option 2
	#[serde(rename = "option2")]
	Option2,
}

impl SomeEnum {
	pub fn from<T: IntoSomeEnum>(thing: T) -> Self {
		thing.into_some_enum()
	}

	/// This is option 1
	pub fn option1(value: SomeStruct) -> Self {
		SomeEnum::Option1(value)
	}

	/// This is option 2
	pub fn option2() -> Self {
		SomeEnum::Option2
	}

	pub fn serialize(&self) -> Result<serde_json::Value, serde_json::Error> {
		serde_json::to_value(self)
	}

	pub fn deserialize(value: &serde_json::Value, path: &str) -> Result<Self, String> {
		let base_error_message = format!("failed to deserialize into '{}' at '{}'", "some_enum", path);

		if !value.is_object() {
			return Err(format!("{}: value is not an object", base_error_message));
		}

		let obj = value.as_object().unwrap();

		if obj.contains_key("option1") {
			let value = SomeStruct::deserialize(&obj["option1"], &format!("{}/{}", path, "option1"))?;
			Ok(SomeEnum::Option1(value))
		}
		else if obj.contains_key("option2") {
			Ok(SomeEnum::Option2)
		}
		else {
			Err(format!("{}: value does not contain any recognized variants", base_error_message))
		}
	}
}



/// This is the main struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MainStruct {
	/// This is the title
	#[serde(rename = "title")]
	#[serde(skip_serializing_if = "Option::is_none")]
	pub title: Option<String>,
	/// This is the title
	#[serde(rename = "something")]
	#[serde(skip_serializing_if = "Option::is_none")]
	pub something: Option<SomeEnum>,
}

impl MainStruct {
	pub fn new() -> Self {
		Self::default()
	}

	/// This is the title
	pub fn with_title(mut self, title: String) -> Self {
		self.title = Some(title);
		self
	}

	/// This is the title
	pub fn with_something(mut self, something: impl IntoSomeEnum) -> Self {
		self.something = Some(SomeEnum::from(something));
		self
	}

	pub fn serialize(&self) -> Result<serde_json::Value, serde_json::Error> {
		serde_json::to_value(self)
	}

	pub fn deserialize(value: &serde_json::Value, path: &str) -> Result<Self, String> {
		let base_error_message = format!("failed to deserialize into '{}' at '{}'", "main_struct", path);

		if !value.is_object() {
			return Err(format!("{}: value is not an object", base_error_message));
		}

		let obj = value.as_object().unwrap();

		let mut result = Self::new();

		if let Some(value) = obj.get("title") {
			result.title = Some(deserialize_string(&value, &format!("{}/{}", path, "title"))?);
		}
		if let Some(value) = obj.get("something") {
			result.something = Some(SomeEnum::deserialize(&value, &format!("{}/{}", path, "something"))?);
		}

		Ok(result)
	}
}

impl Default for MainStruct {
	fn default() -> Self {
		Self {
			title: None,
			something: None,
		}
	}
}

