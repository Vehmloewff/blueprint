import { pascalCase, snakeCase } from 'change-case'
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
		generator.pushLine()
	}

	generateEnum(generator: Generator, name: string, e: EnumBody): void {
		const enumName = pascalCase(name)

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
				const typeStr = valueEnumName ? `impl Into<${valueEnumName}>` : this.#buildType(field.type)

				const methodName = `with_${snakeCase(fieldName)}`

				this.#generateDocComment(generator, field.description)
				generator.pushIn(`pub fn ${methodName}(mut self, ${rustFieldName}: ${typeStr}) -> Self `, generator => {
					if (valueEnumName) {
						if (field.required) {
							generator.pushLine(`self.${rustFieldName} = ${rustFieldName}.into();`)
						} else {
							generator.pushLine(`self.${rustFieldName} = Some(${rustFieldName}.into());`)
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
		})
		generator.pushLine()

		// Generate Into trait implementations for enums
		for (const instance of enumReferences) {
			const enumName = pascalCase(instance.enumName)
			const methodName = snakeCase(instance.variantName)

			generator.pushIn(`impl Into<${enumName}> for ${structName} `, generator => {
				generator.pushIn(`fn into(self) -> ${enumName} `, generator => {
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
