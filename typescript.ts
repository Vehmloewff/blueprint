import { pascalCase, camelCase } from 'change-case'
import type { Generator } from './generator'
import type { Language } from './language'
import type { EnumBody, StructBody, TypeDef } from './type_def'

export class Typescript implements Language {
	#enumVariantTypes = new Map<string, Set<string>>() // enum name -> set of struct names used as variants
	#enumDefinitions = new Map<string, EnumBody>() // enum name -> enum definition

	generateHeader(generator: Generator): void {
		generator.pushLine('function deserializeString(value: unknown, path: string) {')
		generator.pushLine(
			"\tif (typeof value !== 'string') throw new Error(`failed to deserialize into string at ${path}: value is not a string`)"
		)
		generator.pushLine()
		generator.pushLine('\treturn value')
		generator.pushLine('}')
		generator.pushLine()
		generator.pushLine('function deserializeNumber(value: unknown, path: string) {')
		generator.pushLine(
			"\tif (typeof value !== 'number') throw new Error(`failed to deserialize into number at ${path}: value is not a number`)"
		)
		generator.pushLine()
		generator.pushLine('\treturn value')
		generator.pushLine('}')
		generator.pushLine()
		generator.pushLine('function deserializeBool(value: unknown, path: string) {')
		generator.pushLine(
			"\tif (typeof value !== 'boolean') throw new Error(`failed to deserialize into boolean at ${path}: value is not a boolean`)"
		)
		generator.pushLine()
		generator.pushLine('\treturn value')
		generator.pushLine('}')
		generator.pushLine()
		generator.pushLine(
			'function deserializeList<T>(value: unknown, path: string, deserializeItem: (item: unknown, itemPath: string) => T): T[] {'
		)
		generator.pushLine(
			'\tif (!Array.isArray(value)) throw new Error(`failed to deserialize into list at ${path}: value is not an array`)'
		)
		generator.pushLine()
		generator.pushLine('\treturn value.map((item, index) => deserializeItem(item, `${path}[${index}]`))')
		generator.pushLine('}')
		generator.pushLine()
	}

	analyze(items: Map<string, { kind: 'struct' | 'enum'; body: StructBody | EnumBody }>): void {
		// Clear existing relationships
		this.#enumVariantTypes.clear()
		this.#enumDefinitions.clear()

		// Analyze all enum definitions to find struct relationships
		for (const [itemName, item] of items.entries()) {
			if (item.kind === 'enum') {
				const enumBody = item.body as EnumBody
				this.#enumDefinitions.set(itemName, enumBody)

				const structVariantTypes = new Set<string>()
				for (const [variantKey, variant] of Object.entries(enumBody.variants)) {
					if (variant.type && variant.type.kind === 'ref') {
						structVariantTypes.add(variant.type.name)
					}
				}
				if (structVariantTypes.size > 0) {
					this.#enumVariantTypes.set(itemName, structVariantTypes)
				}
			}
		}
	}

	generateEnum(generator: Generator, name: string, e: EnumBody): void {
		const isTagged = Object.values(e.variants).find(variant => variant.type !== undefined)
		const enumName = pascalCase(name)

		// Generate interface for things that can convert into this enum
		if (isTagged) {
			generator.pushLine(`export interface Into${enumName} {`)
			generator.pushLine(`\tinto${enumName}(): ${enumName}`)
			generator.pushLine('}')
			generator.pushLine()
			generator.pushLine()
		}

		// Generate the main enum class
		this.#generateDocComment(generator, e.description)
		generator.pushIn(`export class ${enumName} `, generator => {
			// Add variant fields
			for (const [variantKey, variant] of Object.entries(e.variants)) {
				if (variant.type) {
					generator.pushLine(`${variantKey}?: ${this.#buildType(variant.type)}`)
				} else {
					generator.pushLine(`${variantKey}?: {}`)
				}
			}

			generator.pushLine()

			// Add static from method for tagged enums
			if (isTagged) {
				generator.pushIn(`static from(thing: Into${enumName} | ${enumName}) `, generator => {
					generator.pushLine(`if (thing instanceof ${enumName}) return thing`)
					generator.pushLine()
					generator.pushLine(`return thing.into${enumName}()`)
				})
				generator.pushLine()
			}

			// Add variant constructor methods
			for (const [variantKey, variant] of Object.entries(e.variants)) {
				this.#generateDocComment(generator, variant.description)

				if (variant.type) {
					generator.pushIn(`static ${camelCase(variantKey)}(value: ${this.#buildType(variant.type)}) `, generator => {
						generator.pushLine(`const e = new ${enumName}()`)
						generator.pushLine(`e.${variantKey} = value`)
						generator.pushLine()
						generator.pushLine(`return e`)
					})
				} else {
					generator.pushIn(`static ${camelCase(variantKey)}() `, generator => {
						generator.pushLine(`const e = new ${enumName}()`)
						generator.pushLine(`e.${variantKey} = {}`)
						generator.pushLine()
						generator.pushLine(`return e`)
					})
				}
				generator.pushLine()
			}

			// Add serialize method
			generator.pushIn(`serialize() `, generator => {
				generator.pushLine(`const value: Record<string, unknown> = {}`)
				generator.pushLine()

				for (const [variantKey, variant] of Object.entries(e.variants)) {
					if (variant.type) {
						generator.pushLine(
							`if (this.${variantKey}) value.${variantKey} = ${this.#buildSerializer(variant.type, `this.${variantKey}`)}`
						)
					} else {
						generator.pushLine(`if (this.${variantKey} !== undefined) value.${variantKey} = {}`)
					}
				}

				generator.pushLine()
				generator.pushLine(`return value`)
			})

			generator.pushLine()

			// Add static deserialize method
			generator.pushIn(`static deserialize(value: unknown, path: string) `, generator => {
				generator.pushLine(`const baseErrorMessage = \`failed to deserialize into '${name}' at '\${path}'\``)
				generator.pushLine(
					`if (!value || typeof value !== 'object') throw new Error(\`\${baseErrorMessage}: value is not an object.\`)`
				)
				generator.pushLine()

				generator.pushLine(`const self = new ${enumName}()`)
				generator.pushLine()

				for (const [index, [variantKey, variant]] of Object.entries(e.variants).entries()) {
					const condition = index === 0 ? 'if' : 'else if'

					generator.pushIn(`${condition} ('${variantKey}' in value) `, generator => {
						if (variant.type) {
							generator.pushLine(
								`self.${variantKey} = ${this.#buildDeserializer(variant.type, `value.${variantKey}`, `\`\${path}/${variantKey}\``)}`
							)
						} else {
							generator.pushLine(`self.${variantKey} = {}`)
						}
					})
				}

				generator.pushLine(`else throw new Error(\`\${baseErrorMessage}: value does not contain any recognized variants.\`)`)
				generator.pushLine()
				generator.pushLine(`return self`)
			})
		})
	}

	generateStruct(generator: Generator, name: string, struct: StructBody) {
		const className = pascalCase(name)
		const requiredFields = Object.entries(struct.fields).filter(([_, field]) => field.required)
		const optionalFields = Object.entries(struct.fields).filter(([_, field]) => !field.required)

		// Check if this struct is used as an enum variant
		const implementsInterfaces: string[] = []
		for (const [enumName, variantTypes] of this.#enumVariantTypes.entries()) {
			if (variantTypes.has(name)) {
				implementsInterfaces.push(`Into${pascalCase(enumName)}`)
			}
		}

		const implementsClause = implementsInterfaces.length > 0 ? ` implements ${implementsInterfaces.join(', ')}` : ''

		this.#generateDocComment(generator, struct.description)
		generator.pushIn(`export class ${className}${implementsClause} `, generator => {
			// Add field declarations
			for (const [fieldName, field] of Object.entries(struct.fields)) {
				const camelFieldName = camelCase(fieldName)
				const typeStr = this.#buildType(field.type)
				const optional = field.required ? '' : '?'

				generator.pushLine(`${camelFieldName}${optional}: ${typeStr}`)
			}

			generator.pushLine()

			// Add constructor for required fields
			if (requiredFields.length > 0) {
				const constructorParams = requiredFields
					.map(([fieldName, field]) => `${camelCase(fieldName)}: ${this.#buildType(field.type)}`)
					.join(', ')

				generator.pushIn(`constructor(${constructorParams}) `, generator => {
					for (const [fieldName] of requiredFields) {
						const camelFieldName = camelCase(fieldName)
						generator.pushLine(`this.${camelFieldName} = ${camelFieldName}`)
					}
				})
			}

			generator.pushLine()

			// Add static new method
			if (requiredFields.length > 0) {
				const constructorParams = requiredFields
					.map(([fieldName, field]) => `${camelCase(fieldName)}: ${this.#buildType(field.type)}`)
					.join(', ')

				generator.pushIn(`static new(${constructorParams}) `, generator => {
					const args = requiredFields.map(([fieldName]) => camelCase(fieldName)).join(', ')
					generator.pushLine(`return new this(${args})`)
				})
			} else {
				generator.pushIn(`static new() `, generator => {
					generator.pushLine(`return new this()`)
				})
			}

			generator.pushLine()

			// Add with methods for all fields
			for (const [fieldName, field] of Object.entries(struct.fields)) {
				const camelFieldName = camelCase(fieldName)
				let typeStr = this.#buildType(field.type)
				const methodName = `with${pascalCase(fieldName)}`

				// Check if this field accepts an enum type and add the Into interface
				if (field.type.kind === 'ref') {
					const refTypeName = field.type.name
					const interfaceName = `Into${pascalCase(refTypeName)}`

					// Check if this referenced type is an enum
					if (this.#enumVariantTypes.has(refTypeName)) {
						typeStr = `${interfaceName} | ${typeStr}`
					}
				}

				generator.pushIn(`${methodName}(${camelFieldName}: ${typeStr}) `, generator => {
					if (field.type.kind === 'ref' && this.#enumVariantTypes.has(field.type.name)) {
						const enumClassName = pascalCase(field.type.name)
						generator.pushLine(`this.${camelFieldName} = ${enumClassName}.from(${camelFieldName})`)
					} else {
						generator.pushLine(`this.${camelFieldName} = ${camelFieldName}`)
					}
					generator.pushLine()
					generator.pushLine(`return this`)
				})

				generator.pushLine()
			}

			// Add intoEnum methods for implemented interfaces
			for (const [enumName, variantTypes] of this.#enumVariantTypes.entries()) {
				if (variantTypes.has(name)) {
					const enumClassName = pascalCase(enumName)
					const methodName = `into${enumClassName}`

					// Find which variant this struct corresponds to by looking up the enum definition
					const variantName = this.#findVariantForStruct(enumName, name)

					generator.pushIn(`${methodName}() `, generator => {
						generator.pushLine(`return ${enumClassName}.${camelCase(variantName)}(this)`)
					})
					generator.pushLine()
				}
			}

			// Add serialize method
			generator.pushIn(`serialize(): unknown `, generator => {
				generator.pushLine('const serialized: Record<string, unknown> = {}')
				generator.pushLine()

				for (const [fieldName, field] of Object.entries(struct.fields)) {
					const camelFieldName = camelCase(fieldName)

					generator.pushLine(
						`if (this.${camelFieldName} !== undefined) serialized.${fieldName} = ${this.#buildSerializer(field.type, `this.${camelFieldName}`)}`
					)
				}

				generator.pushLine()
				generator.pushLine('return serialized')
			})

			generator.pushLine()

			// Add static deserialize method
			generator.pushIn(`static deserialize(value: unknown, path: string = '#') `, generator => {
				generator.pushLine(`const baseErrorMessage = \`failed to deserialize into '${name}' at '\${path}'\``)
				generator.pushLine(
					`if (!value || typeof value !== 'object') throw new Error(\`\${baseErrorMessage}: value is not an object.\`)`
				)
				generator.pushLine()

				// Check required fields
				for (const [fieldName] of requiredFields) {
					generator.pushLine(
						`if (!('${fieldName}' in value)) throw new Error(\`\${baseErrorMessage}: value does not contain required field '${fieldName}'.\`)`
					)
				}

				// Create instance
				const requiredArgs = requiredFields
					.map(([fieldName, field]) => this.#buildDeserializer(field.type, `value.${fieldName}`, `\`\${path}/${fieldName}\``))
					.join(', ')

				generator.pushLine(`const self = new this(${requiredArgs})`)
				generator.pushLine()

				// Handle optional fields
				for (const [fieldName, field] of optionalFields) {
					const camelFieldName = camelCase(fieldName)
					const deserializer = this.#buildDeserializer(field.type, `value.${fieldName}`, `\`\${path}/${fieldName}\``)

					generator.pushLine(`if ('${fieldName}' in value) self.${camelFieldName} = ${deserializer}`)
				}

				generator.pushLine()
				generator.pushLine(`return self`)
			})
		})
	}

	#buildSerializer(type: TypeDef, valueExpr: string): string {
		if (type.kind === 'ref') return `${valueExpr}.serialize()`
		if (type.kind === 'list') return `${valueExpr}.map(value => ${this.#buildSerializer(type.of, 'value')})`

		return valueExpr
	}

	#buildDeserializer(type: TypeDef, valueExpr: string, pathExpr: string): string {
		if (type.kind === 'string') return `deserializeString(${valueExpr}, ${pathExpr})`
		if (type.kind === 'number') return `deserializeNumber(${valueExpr}, ${pathExpr})`
		if (type.kind === 'boolean') return `deserializeBool(${valueExpr}, ${pathExpr})`
		if (type.kind === 'ref') return `${pascalCase(type.name)}.deserialize(${valueExpr}, ${pathExpr})`
		if (type.kind === 'list') {
			const itemDeserializer = this.#buildDeserializer(type.of, 'item', 'itemPath')
			return `deserializeList(${valueExpr}, ${pathExpr}, (item, itemPath) => ${itemDeserializer})`
		}

		throw new Error('Unknown type kind')
	}

	#findVariantForStruct(enumName: string, structName: string): string {
		const enumDef = this.#enumDefinitions.get(enumName)
		if (!enumDef) return 'option1' // fallback

		for (const [variantKey, variant] of Object.entries(enumDef.variants)) {
			if (variant.type && variant.type.kind === 'ref' && variant.type.name === structName) {
				return variantKey
			}
		}
		return 'option1' // fallback
	}

	#buildType(type: TypeDef): string {
		if (type.kind === 'string') return 'string'
		if (type.kind === 'boolean') return 'boolean'
		if (type.kind === 'list') return `${this.#buildType(type.of)}[]`
		if (type.kind === 'number') return 'number'
		if (type.kind === 'ref') return pascalCase(type.name)

		throw new Error('Unknown type kind')
	}

	#generateDocComment(generator: Generator, description: string) {
		const lines = description.trim().split('\n')

		if (lines.length > 1) generator.pushLine('/**')

		for (const [index, line] of lines.entries()) {
			const opener = lines.length > 1 ? ' * ' : '/** '
			const suffix = index === lines.length - 1 ? ' */' : ''

			generator.pushLine(opener + line + suffix)
		}
	}
}
