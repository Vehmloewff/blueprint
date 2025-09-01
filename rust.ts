import { pascalCase, camelCase, snakeCase } from 'change-case'
import { Generator } from './generator'
import type { Language, TypeAnalyzer } from './language'
import type { EnumBody, StructBody, TypeDef } from './type_def'

export class Rust implements Language {
	#analyzer: TypeAnalyzer

	constructor(analyzer: TypeAnalyzer) {
		this.#analyzer = analyzer
	}

	generateHeader(generator: Generator): void {
		generator.pushLine('use serde::{Deserialize, Serialize};')
		generator.pushLine('use std::collections::HashMap;')
		generator.pushLine()

		// Generate deserializer helper functions
		if (this.#analyzer.getInstances({ kind: 'string' }).length) {
			generator.pushIn('fn deserialize_string(value: &serde_json::Value, path: &str) -> Result<String, String> ', generator => {
				generator.pushLine('match value {')
				generator.pushLine('\tserde_json::Value::String(s) => Ok(s.clone()),')
				generator.pushLine('\t_ => Err(format!("failed to deserialize into string at {}: value is not a string", path)),')
				generator.pushLine('}')
			})
			generator.pushLine()
		}

		if (this.#analyzer.getInstances({ kind: 'number' }).length) {
			generator.pushIn('fn deserialize_i32(value: &serde_json::Value, path: &str) -> Result<i32, String> ', generator => {
				generator.pushLine('match value {')
				generator.pushLine('\tserde_json::Value::Number(n) => {')
				generator.pushLine('\t\tlet i64_val = n.as_i64()')
				generator.pushLine('\t\t\t.ok_or_else(|| format!("failed to deserialize into number at {}: invalid number", path))?;')
				generator.pushLine('\t\ti64_val.try_into()')
				generator.pushLine('\t\t\t.map_err(|_| format!("failed to deserialize into number at {}: number out of range", path))')
				generator.pushLine('\t}')
				generator.pushLine('\t_ => Err(format!("failed to deserialize into number at {}: value is not a number", path)),')
				generator.pushLine('}')
			})
			generator.pushLine()

			generator.pushIn('fn deserialize_f64(value: &serde_json::Value, path: &str) -> Result<f64, String> ', generator => {
				generator.pushLine('match value {')
				generator.pushLine(
					'\tserde_json::Value::Number(n) => n.as_f64().ok_or_else(|| format!("failed to deserialize into number at {}: invalid number", path)),'
				)
				generator.pushLine('\t_ => Err(format!("failed to deserialize into number at {}: value is not a number", path)),')
				generator.pushLine('}')
			})
			generator.pushLine()
		}

		if (this.#analyzer.getInstances({ kind: 'boolean' }).length) {
			generator.pushIn('fn deserialize_bool(value: &serde_json::Value, path: &str) -> Result<bool, String> ', generator => {
				generator.pushLine('match value {')
				generator.pushLine('\tserde_json::Value::Bool(b) => Ok(*b),')
				generator.pushLine('\t_ => Err(format!("failed to deserialize into boolean at {}: value is not a boolean", path)),')
				generator.pushLine('}')
			})
			generator.pushLine()
		}

		if (this.#analyzer.getInstances({ kind: 'list', of: { kind: 'unknown' } }).length) {
			generator.pushIn(
				'fn deserialize_list<T, F>(value: &serde_json::Value, path: &str, deserialize_item: F) -> Result<Vec<T>, String> where F: Fn(&serde_json::Value, &str) -> Result<T, String> ',
				generator => {
					generator.pushLine('match value {')
					generator.pushLine('\tserde_json::Value::Array(arr) => {')
					generator.pushLine('\t\tlet mut result = Vec::new();')
					generator.pushLine('\t\tfor (index, item) in arr.iter().enumerate() {')
					generator.pushLine('\t\t\tlet item_path = format!("{}[{}]", path, index);')
					generator.pushLine('\t\t\tresult.push(deserialize_item(item, &item_path)?);')
					generator.pushLine('\t\t}')
					generator.pushLine('\t\tOk(result)')
					generator.pushLine('\t}')
					generator.pushLine('\t_ => Err(format!("failed to deserialize into list at {}: value is not an array", path)),')
					generator.pushLine('}')
				}
			)
			generator.pushLine()
		}
	}

	generateEnum(generator: Generator, name: string, e: EnumBody): void {
		const enumName = pascalCase(name)

		// Generate trait for things that can convert into this enum
		this.#generateDocComment(generator, `Trait for types that can convert into ${enumName}`)
		generator.pushIn(`pub trait Into${enumName} `, generator => {
			generator.pushLine(`fn into_${snakeCase(name)}(self) -> ${enumName};`)
		})
		generator.pushLine()

		// Generate the main enum
		this.#generateDocComment(generator, e.description)
		generator.pushLine('#[derive(Debug, Clone, Serialize, Deserialize)]')
		generator.pushLine('#[serde(untagged)]')
		generator.pushIn(`pub enum ${enumName} `, generator => {
			// Add variant definitions
			for (const [variantKey, variant] of Object.entries(e.variants)) {
				const variantName = pascalCase(variantKey)
				this.#generateDocComment(generator, variant.description)
				if (variant.type) {
					generator.pushLine(`#[serde(rename = "${variantKey}")]`)
					generator.pushLine(`${variantName}(${this.#buildType(variant.type)}),`)
				} else {
					generator.pushLine(`#[serde(rename = "${variantKey}")]`)
					generator.pushLine(`${variantName},`)
				}
			}
		})
		generator.pushLine()

		// Generate implementation block
		generator.pushIn(`impl ${enumName} `, generator => {
			// Add from method for trait objects
			generator.pushIn(`pub fn from<T: Into${enumName}>(thing: T) -> Self `, generator => {
				generator.pushLine('thing.into_' + snakeCase(name) + '()')
			})
			generator.pushLine()

			// Add variant constructor methods
			for (const [variantKey, variant] of Object.entries(e.variants)) {
				const variantName = pascalCase(variantKey)
				const methodName = snakeCase(variantKey)

				this.#generateDocComment(generator, variant.description)
				if (variant.type) {
					generator.pushIn(`pub fn ${methodName}(value: ${this.#buildType(variant.type)}) -> Self `, generator => {
						generator.pushLine(`${enumName}::${variantName}(value)`)
					})
				} else {
					generator.pushIn(`pub fn ${methodName}() -> Self `, generator => {
						generator.pushLine(`${enumName}::${variantName}`)
					})
				}
				generator.pushLine()
			}

			// Add serialize method (redundant with Serialize derive, but for consistency)
			generator.pushIn(`pub fn serialize(&self) -> Result<serde_json::Value, serde_json::Error> `, generator => {
				generator.pushLine('serde_json::to_value(self)')
			})
			generator.pushLine()

			// Add deserialize method
			generator.pushIn(`pub fn deserialize(value: &serde_json::Value, path: &str) -> Result<Self, String> `, generator => {
				generator.pushLine(`let base_error_message = format!("failed to deserialize into '{}' at '{}'", "${name}", path);`)
				generator.pushLine()
				generator.pushLine('if !value.is_object() {')
				generator.pushLine('\treturn Err(format!("{}: value is not an object", base_error_message));')
				generator.pushLine('}')
				generator.pushLine()
				generator.pushLine('let obj = value.as_object().unwrap();')
				generator.pushLine()

				for (const [index, [variantKey, variant]] of Object.entries(e.variants).entries()) {
					const variantName = pascalCase(variantKey)
					const condition = index === 0 ? 'if' : 'else if'

					generator.pushLine(`${condition} obj.contains_key("${variantKey}") {`)
					if (variant.type) {
						const deserializer = this.#buildDeserializer(
							variant.type,
							`obj["${variantKey}"]`,
							`&format!("{}/{}", path, "${variantKey}")`
						)
						generator.pushLine(`\tlet value = ${deserializer}?;`)
						generator.pushLine(`\tOk(${enumName}::${variantName}(value))`)
					} else {
						generator.pushLine(`\tOk(${enumName}::${variantName})`)
					}
					generator.pushLine('}')
				}

				generator.pushLine('else {')
				generator.pushLine('\tErr(format!("{}: value does not contain any recognized variants", base_error_message))')
				generator.pushLine('}')
			})
		})
		generator.pushLine()
	}

	generateStruct(generator: Generator, name: string, struct: StructBody): void {
		const structName = pascalCase(name)
		const requiredFields = Object.entries(struct.fields).filter(([_, field]) => field.required)
		const optionalFields = Object.entries(struct.fields).filter(([_, field]) => !field.required)
		const enumReferences = this.#analyzer.getInstances({ kind: 'ref', name }).filter(instance => instance.kind === 'enum')

		// Generate the main struct
		this.#generateDocComment(generator, struct.description)
		generator.pushLine('#[derive(Debug, Clone, Serialize, Deserialize)]')
		generator.pushIn(`pub struct ${structName} `, generator => {
			// Add field declarations
			for (const [fieldName, field] of Object.entries(struct.fields)) {
				const rustFieldName = snakeCase(fieldName)
				const typeStr = field.required ? this.#buildType(field.type) : `Option<${this.#buildType(field.type)}>`

				this.#generateDocComment(generator, field.description)
				generator.pushLine(`#[serde(rename = "${fieldName}")]`)
				if (!field.required) {
					generator.pushLine('#[serde(skip_serializing_if = "Option::is_none")]')
				}
				generator.pushLine(`pub ${rustFieldName}: ${typeStr},`)
			}
		})
		generator.pushLine()

		// Generate implementation block
		generator.pushIn(`impl ${structName} `, generator => {
			// Add constructor for required fields
			if (requiredFields.length > 0) {
				const constructorParams = requiredFields
					.map(([fieldName, field]) => `${snakeCase(fieldName)}: ${this.#buildType(field.type)}`)
					.join(', ')

				this.#generateDocComment(generator, struct.description)
				generator.pushIn(`pub fn new(${constructorParams}) -> Self `, generator => {
					generator.pushLine(`Self {`)
					for (const [fieldName] of requiredFields) {
						const rustFieldName = snakeCase(fieldName)
						generator.pushLine(`\t${rustFieldName},`)
					}
					for (const [fieldName] of optionalFields) {
						const rustFieldName = snakeCase(fieldName)
						generator.pushLine(`\t${rustFieldName}: None,`)
					}
					generator.pushLine(`}`)
				})
			} else {
				generator.pushIn(`pub fn new() -> Self `, generator => {
					generator.pushLine(`Self::default()`)
				})
			}
			generator.pushLine()

			// Add with methods for all fields
			for (const [fieldName, field] of Object.entries(struct.fields)) {
				const rustFieldName = snakeCase(fieldName)
				const valueEnumName =
					field.type.kind === 'ref' && this.#analyzer.checkItem(field.type.name) === 'enum' ? pascalCase(field.type.name) : null
				const typeStr = valueEnumName ? `impl Into${valueEnumName}` : this.#buildType(field.type)

				const methodName = `with_${snakeCase(fieldName)}`

				this.#generateDocComment(generator, field.description)
				generator.pushIn(`pub fn ${methodName}(mut self, ${rustFieldName}: ${typeStr}) -> Self `, generator => {
					if (valueEnumName) {
						if (field.required) {
							generator.pushLine(`self.${rustFieldName} = ${valueEnumName}::from(${rustFieldName});`)
						} else {
							generator.pushLine(`self.${rustFieldName} = Some(${valueEnumName}::from(${rustFieldName}));`)
						}
					} else {
						if (field.required) {
							generator.pushLine(`self.${rustFieldName} = ${rustFieldName};`)
						} else {
							generator.pushLine(`self.${rustFieldName} = Some(${rustFieldName});`)
						}
					}
					generator.pushLine('self')
				})
				generator.pushLine()
			}

			// Add serialize method (redundant with Serialize derive, but for consistency)
			generator.pushIn(`pub fn serialize(&self) -> Result<serde_json::Value, serde_json::Error> `, generator => {
				generator.pushLine('serde_json::to_value(self)')
			})
			generator.pushLine()

			// Add deserialize method
			generator.pushIn(`pub fn deserialize(value: &serde_json::Value, path: &str) -> Result<Self, String> `, generator => {
				generator.pushLine(`let base_error_message = format!("failed to deserialize into '{}' at '{}'", "${name}", path);`)
				generator.pushLine()
				generator.pushLine('if !value.is_object() {')
				generator.pushLine('\treturn Err(format!("{}: value is not an object", base_error_message));')
				generator.pushLine('}')
				generator.pushLine()
				generator.pushLine('let obj = value.as_object().unwrap();')
				generator.pushLine()

				// Check required fields
				for (const [fieldName] of requiredFields) {
					generator.pushLine(`if !obj.contains_key("${fieldName}") {`)
					generator.pushLine(
						`\treturn Err(format!("{}: value does not contain required field '${fieldName}'", base_error_message));`
					)
					generator.pushLine('}')
				}

				// Deserialize required fields
				const requiredArgs = requiredFields
					.map(([fieldName, field]) => {
						const deserializer = this.#buildDeserializer(
							field.type,
							`obj["${fieldName}"]`,
							`&format!("{}/{}", path, "${fieldName}")`
						)
						return `${deserializer}?`
					})
					.join(', ')

				generator.pushLine(`let mut result = Self::new(${requiredArgs});`)
				generator.pushLine()

				// Handle optional fields
				for (const [fieldName, field] of optionalFields) {
					const rustFieldName = snakeCase(fieldName)
					const deserializer = this.#buildDeserializer(field.type, `value`, `&format!("{}/{}", path, "${fieldName}")`)

					generator.pushLine(`if let Some(value) = obj.get("${fieldName}") {`)
					generator.pushLine(`\tresult.${rustFieldName} = Some(${deserializer}?);`)
					generator.pushLine('}')
				}

				generator.pushLine()
				generator.pushLine('Ok(result)')
			})
		})
		generator.pushLine()

		// Generate Into trait implementations for enums
		for (const instance of enumReferences) {
			const enumName = pascalCase(instance.enumName)
			const methodName = snakeCase(instance.variantName)

			generator.pushIn(`impl Into${enumName} for ${structName} `, generator => {
				generator.pushIn(`fn into_${snakeCase(instance.enumName)}(self) -> ${enumName} `, generator => {
					generator.pushLine(`${enumName}::${methodName}(self)`)
				})
			})
			generator.pushLine()
		}

		// Generate Default implementation for structs with no required fields
		if (requiredFields.length === 0) {
			generator.pushIn(`impl Default for ${structName} `, generator => {
				generator.pushIn(`fn default() -> Self `, generator => {
					generator.pushLine(`Self {`)
					for (const [fieldName] of optionalFields) {
						const rustFieldName = snakeCase(fieldName)
						generator.pushLine(`\t${rustFieldName}: None,`)
					}
					generator.pushLine(`}`)
				})
			})
			generator.pushLine()
		}
	}

	#buildSerializer(type: TypeDef, valueExpr: string): string {
		if (type.kind === 'ref') return `${valueExpr}.serialize()?`
		if (type.kind === 'list') {
			return `${valueExpr}.iter().map(|v| ${this.#buildSerializer(type.of, 'v')}).collect::<Result<Vec<_>, _>>()?`
		}

		return valueExpr
	}

	#buildDeserializer(type: TypeDef, valueExpr: string, pathExpr: string): string {
		if (type.kind === 'string') return `deserialize_string(&${valueExpr}, ${pathExpr})`
		if (type.kind === 'number') {
			if (type.behavior && ['f32', 'f64'].includes(type.behavior)) {
				return `deserialize_f64(&${valueExpr}, ${pathExpr})`
			}
			return `deserialize_i32(&${valueExpr}, ${pathExpr})`
		}
		if (type.kind === 'boolean') return `deserialize_bool(&${valueExpr}, ${pathExpr})`
		if (type.kind === 'ref') return `${pascalCase(type.name)}::deserialize(&${valueExpr}, ${pathExpr})`
		if (type.kind === 'list') {
			const itemDeserializer = this.#buildDeserializer(type.of, 'item', 'item_path')
			return `deserialize_list(&${valueExpr}, ${pathExpr}, |item, item_path| ${itemDeserializer})`
		}

		throw new Error('Unknown type kind')
	}

	#buildType(type: TypeDef): string {
		if (type.kind === 'string') return 'String'
		if (type.kind === 'boolean') return 'bool'
		if (type.kind === 'list') return `Vec<${this.#buildType(type.of)}>`
		if (type.kind === 'number') {
			if (type.behavior) {
				switch (type.behavior) {
					case 'u8':
						return 'u8'
					case 'u16':
						return 'u16'
					case 'u32':
						return 'u32'
					case 'u64':
						return 'u64'
					case 'i8':
						return 'i8'
					case 'i16':
						return 'i16'
					case 'i32':
						return 'i32'
					case 'i64':
						return 'i64'
					case 'f32':
						return 'f32'
					case 'f64':
						return 'f64'
					default:
						return 'f64'
				}
			}
			return 'f64'
		}
		if (type.kind === 'ref') return pascalCase(type.name)

		throw new Error('Unknown type kind')
	}

	#generateDocComment(generator: Generator, description: string) {
		const lines = description.trim().split('\n')

		for (const line of lines) {
			generator.pushLine(`/// ${line}`)
		}
	}
}
