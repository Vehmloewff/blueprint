use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
        Self { foo, bar: None }
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
}

impl Default for MainStruct {
    fn default() -> Self {
        Self {
            title: None,
            something: None,
        }
    }
}
