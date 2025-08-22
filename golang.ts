import { pascalCase, camelCase } from 'change-case'
import { Generator } from './generator'
import type { Language, TypeAnalyzer } from './language'
import type { EnumBody, StructBody, TypeDef } from './type_def'

export class Golang implements Language {
	#analyzer: TypeAnalyzer

	constructor(analyzer: TypeAnalyzer) {
		this.#analyzer = analyzer
	}

	generateHeader(generator: Generator): void {
		generator.pushLine('package main')
		generator.pushLine()
		generator.pushLine('import (')
		generator.pushLine('\t"fmt"')
		generator.pushLine(')')
		generator.pushLine()

		// Generate deserializer helper functions
		if (this.#analyzer.getInstances({ kind: 'string' }).length) {
			generator.pushIn('func deserializeString(value any, path string) (string, error) ', generator => {
				generator.pushLine('str, ok := value.(string)')
				generator.pushLine('if !ok {')
				generator.pushLine('\treturn "", fmt.Errorf("failed to deserialize into string at %s: value is not a string", path)')
				generator.pushLine('}')
				generator.pushLine('return str, nil')
			})
			generator.pushLine()
		}

		if (this.#analyzer.getInstances({ kind: 'number' }).length) {
			generator.pushIn('func deserializeNumber(value any, path string) (float64, error) ', generator => {
				generator.pushLine('num, ok := value.(float64)')
				generator.pushLine('if !ok {')
				generator.pushLine('\treturn 0, fmt.Errorf("failed to deserialize into number at %s: value is not a number", path)')
				generator.pushLine('}')
				generator.pushLine('return num, nil')
			})
			generator.pushLine()
		}

		if (this.#analyzer.getInstances({ kind: 'boolean' }).length) {
			generator.pushIn('func deserializeBool(value any, path string) (bool, error) ', generator => {
				generator.pushLine('b, ok := value.(bool)')
				generator.pushLine('if !ok {')
				generator.pushLine('\treturn false, fmt.Errorf("failed to deserialize into boolean at %s: value is not a boolean", path)')
				generator.pushLine('}')
				generator.pushLine('return b, nil')
			})
			generator.pushLine()
		}

		if (this.#analyzer.getInstances({ kind: 'list', of: { kind: 'unknown' } }).length) {
			generator.pushIn(
				'func deserializeList(value any, path string, deserializeItem func(any, string) (any, error)) ([]any, error) ',
				generator => {
					generator.pushLine('arr, ok := value.([]any)')
					generator.pushLine('if !ok {')
					generator.pushLine('\treturn nil, fmt.Errorf("failed to deserialize into list at %s: value is not an array", path)')
					generator.pushLine('}')
					generator.pushLine()
					generator.pushLine('result := make([]any, len(arr))')
					generator.pushLine('for i, item := range arr {')
					generator.pushLine('\tdeserialized, err := deserializeItem(item, fmt.Sprintf("%s[%d]", path, i))')
					generator.pushLine('\tif err != nil {')
					generator.pushLine('\t\treturn nil, err')
					generator.pushLine('\t}')
					generator.pushLine('\tresult[i] = deserialized')
					generator.pushLine('}')
					generator.pushLine('return result, nil')
				}
			)
			generator.pushLine()
		}
	}

	generateEnum(generator: Generator, name: string, e: EnumBody): void {
		const enumName = pascalCase(name)

		// Generate interface for things that can convert into this enum
		this.#generateDocComment(generator, `Interface for types that can convert into ${enumName}`)
		generator.pushIn(`type Into${enumName} interface `, generator => {
			generator.pushLine(`Into${enumName}() *${enumName}`)
		})
		generator.pushLine()

		// Generate the main enum struct
		this.#generateDocComment(generator, e.description)
		generator.pushIn(`type ${enumName} struct `, generator => {
			// Add variant fields
			for (const [variantKey, variant] of Object.entries(e.variants)) {
				const fieldName = pascalCase(variantKey)
				this.#generateDocComment(generator, variant.description)
				if (variant.type) {
					generator.pushLine(`${fieldName} *${this.#buildType(variant.type)} \`json:"${variantKey},omitempty"\``)
				} else {
					generator.pushLine(`${fieldName} *struct{} \`json:"${variantKey},omitempty"\``)
				}
			}
		})
		generator.pushLine()

		// Add static from method for tagged enums
		this.#generateDocComment(generator, `Creates a ${enumName} from an Into${enumName} or returns the existing ${enumName}`)
		generator.pushIn(`func ${enumName}From(thing any) *${enumName} `, generator => {
			generator.pushLine(`if enum, ok := thing.(*${enumName}); ok {`)
			generator.pushLine('\treturn enum')
			generator.pushLine('}')
			generator.pushLine(`if converter, ok := thing.(Into${enumName}); ok {`)
			generator.pushLine(`\treturn converter.Into${enumName}()`)
			generator.pushLine('}')
			generator.pushLine('return nil')
		})
		generator.pushLine()

		// Add variant constructor methods
		for (const [variantKey, variant] of Object.entries(e.variants)) {
			const methodName = `${enumName}${pascalCase(variantKey)}`
			this.#generateDocComment(generator, variant.description)

			if (variant.type) {
				generator.pushIn(`func ${methodName}(value ${this.#buildType(variant.type)}) *${enumName} `, generator => {
					generator.pushLine(`return &${enumName}{`)
					generator.pushLine(`\t${pascalCase(variantKey)}: &value,`)
					generator.pushLine('}')
				})
			} else {
				generator.pushIn(`func ${methodName}() *${enumName} `, generator => {
					generator.pushLine(`return &${enumName}{`)
					generator.pushLine(`\t${pascalCase(variantKey)}: &struct{}{},`)
					generator.pushLine('}')
				})
			}
			generator.pushLine()
		}

		// Add serialize method
		this.#generateDocComment(generator, `Serializes the ${enumName} to a map for JSON encoding`)
		generator.pushIn(`func (e *${enumName}) Serialize() map[string]any `, generator => {
			generator.pushLine('result := make(map[string]any)')
			generator.pushLine()

			for (const [variantKey, variant] of Object.entries(e.variants)) {
				const fieldName = pascalCase(variantKey)
				if (variant.type) {
					generator.pushLine(`if e.${fieldName} != nil {`)
					if (variant.type.kind === 'ref') {
						generator.pushLine(`\tresult["${variantKey}"] = e.${fieldName}.Serialize()`)
					} else {
						generator.pushLine(`\tresult["${variantKey}"] = ${this.#buildSerializer(variant.type, `*e.${fieldName}`)}`)
					}
					generator.pushLine('}')
				} else {
					generator.pushLine(`if e.${fieldName} != nil {`)
					generator.pushLine(`\tresult["${variantKey}"] = struct{}{}`)
					generator.pushLine('}')
				}
			}

			generator.pushLine()
			generator.pushLine('return result')
		})
		generator.pushLine()

		// Add static deserialize method
		this.#generateDocComment(generator, `Deserializes a map into a ${enumName}`)
		generator.pushIn(`func ${enumName}Deserialize(value any, path string) (*${enumName}, error) `, generator => {
			generator.pushLine(`baseErrorMessage := fmt.Sprintf("failed to deserialize into '${name}' at '%s'", path)`)
			generator.pushLine('obj, ok := value.(map[string]any)')
			generator.pushLine('if !ok {')
			generator.pushLine('\treturn nil, fmt.Errorf("%s: value is not an object", baseErrorMessage)')
			generator.pushLine('}')
			generator.pushLine()

			generator.pushLine(`result := &${enumName}{}`)
			generator.pushLine()

			const variants = Object.entries(e.variants)

			// Generate if/else if/else chain manually to ensure proper Go syntax
			for (const [index, [variantKey, variant]] of variants.entries()) {
				const fieldName = pascalCase(variantKey)

				if (index === 0) {
					generator.pushLine(`if _, exists := obj["${variantKey}"]; exists {`)
				} else {
					generator.pushLine(`} else if _, exists := obj["${variantKey}"]; exists {`)
				}

				if (variant.type) {
					generator.pushLine(
						`\tdeserialized, err := ${this.#buildDeserializer(variant.type, `obj["${variantKey}"]`, `fmt.Sprintf("%s/${variantKey}", path)`)}`
					)
					generator.pushLine('\tif err != nil {')
					generator.pushLine('\t\treturn nil, err')
					generator.pushLine('\t}')
					generator.pushLine(`\tresult.${fieldName} = deserialized`)
				} else {
					generator.pushLine(`\tresult.${fieldName} = &struct{}{}`)
				}
			}

			generator.pushLine('} else {')
			generator.pushLine('\treturn nil, fmt.Errorf("%s: value does not contain any recognized variants", baseErrorMessage)')
			generator.pushLine('}')
			generator.pushLine()
			generator.pushLine('return result, nil')
		})
		generator.pushLine()
	}

	generateStruct(generator: Generator, name: string, struct: StructBody) {
		const structName = pascalCase(name)
		const requiredFields = Object.entries(struct.fields).filter(([_, field]) => field.required)
		const optionalFields = Object.entries(struct.fields).filter(([_, field]) => !field.required)
		const enumReferences = this.#analyzer.getInstances({ kind: 'ref', name }).filter(instance => instance.kind === 'enum')

		// Generate the main struct
		this.#generateDocComment(generator, struct.description)
		generator.pushIn(`type ${structName} struct `, generator => {
			// Add field declarations
			for (const [fieldName, field] of Object.entries(struct.fields)) {
				const goFieldName = pascalCase(fieldName)
				const typeStr = this.#buildType(field.type)
				const pointer = field.required ? '' : '*'
				const omitempty = field.required ? '' : ',omitempty'

				this.#generateDocComment(generator, field.description)
				generator.pushLine(`${goFieldName} ${pointer}${typeStr} \`json:"${fieldName}${omitempty}"\``)
			}
		})
		generator.pushLine()

		// Add constructor for required fields
		if (requiredFields.length > 0) {
			const constructorParams = requiredFields
				.map(([fieldName, field]) => `${camelCase(fieldName)} ${this.#buildType(field.type)}`)
				.join(', ')

			this.#generateDocComment(generator, `Creates a new ${structName} with required fields`)
			generator.pushIn(`func New${structName}(${constructorParams}) *${structName} `, generator => {
				generator.pushLine(`return &${structName}{`)
				for (const [fieldName] of requiredFields) {
					const goFieldName = pascalCase(fieldName)
					const paramName = camelCase(fieldName)
					generator.pushLine(`\t${goFieldName}: ${paramName},`)
				}
				generator.pushLine('}')
			})
		} else {
			this.#generateDocComment(generator, `Creates a new ${structName}`)
			generator.pushIn(`func New${structName}() *${structName} `, generator => {
				generator.pushLine(`return &${structName}{}`)
			})
		}
		generator.pushLine()

		// Add with methods for all fields
		for (const [fieldName, field] of Object.entries(struct.fields)) {
			const goFieldName = pascalCase(fieldName)
			const paramName = camelCase(fieldName)
			const valueEnumName =
				field.type.kind === 'ref' && this.#analyzer.checkItem(field.type.name) === 'enum' ? pascalCase(field.type.name) : null
			const typeStr = this.#buildType(field.type)

			const methodName = `With${pascalCase(fieldName)}`

			this.#generateDocComment(generator, field.description)
			if (valueEnumName) {
				generator.pushIn(`func (s *${structName}) ${methodName}(${paramName} any) *${structName} `, generator => {
					generator.pushLine(`s.${goFieldName} = ${valueEnumName}From(${paramName})`)
					generator.pushLine('return s')
				})
			} else {
				generator.pushIn(`func (s *${structName}) ${methodName}(${paramName} ${typeStr}) *${structName} `, generator => {
					if (field.required) {
						generator.pushLine(`s.${goFieldName} = ${paramName}`)
					} else {
						generator.pushLine(`s.${goFieldName} = &${paramName}`)
					}
					generator.pushLine('return s')
				})
			}
			generator.pushLine()
		}

		// Add intoEnum methods for implemented interfaces
		for (const instance of enumReferences) {
			const enumClassName = pascalCase(instance.enumName)
			const methodName = `Into${enumClassName}`

			this.#generateDocComment(generator, `Converts this ${structName} into a ${enumClassName}`)
			generator.pushIn(`func (s *${structName}) ${methodName}() *${enumClassName} `, generator => {
				generator.pushLine(`return ${enumClassName}${pascalCase(instance.variantName)}(*s)`)
			})
			generator.pushLine()
		}

		// Add serialize method
		this.#generateDocComment(generator, `Serializes the ${structName} to a map for JSON encoding`)
		generator.pushIn(`func (s *${structName}) Serialize() map[string]any `, generator => {
			generator.pushLine('result := make(map[string]any)')
			generator.pushLine()

			for (const [fieldName, field] of Object.entries(struct.fields)) {
				const goFieldName = pascalCase(fieldName)

				if (field.required) {
					generator.pushLine(`result["${fieldName}"] = ${this.#buildSerializer(field.type, `s.${goFieldName}`)}`)
				} else {
					generator.pushLine(`if s.${goFieldName} != nil {`)
					if (field.type.kind === 'ref') {
						generator.pushLine(`\tresult["${fieldName}"] = s.${goFieldName}.Serialize()`)
					} else {
						generator.pushLine(`\tresult["${fieldName}"] = ${this.#buildSerializer(field.type, `*s.${goFieldName}`)}`)
					}
					generator.pushLine('}')
				}
			}

			generator.pushLine()
			generator.pushLine('return result')
		})
		generator.pushLine()

		// Add static deserialize method
		this.#generateDocComment(generator, `Deserializes a map into a ${structName}`)
		generator.pushIn(`func ${structName}Deserialize(value any, path string) (*${structName}, error) `, generator => {
			generator.pushLine('if path == "" {')
			generator.pushLine('\tpath = "#"')
			generator.pushLine('}')
			generator.pushLine(`baseErrorMessage := fmt.Sprintf("failed to deserialize into '${name}' at '%s'", path)`)
			generator.pushLine('obj, ok := value.(map[string]any)')
			generator.pushLine('if !ok {')
			generator.pushLine('\treturn nil, fmt.Errorf("%s: value is not an object", baseErrorMessage)')
			generator.pushLine('}')
			generator.pushLine()

			// Check required fields
			for (const [fieldName] of requiredFields) {
				generator.pushLine(`if _, exists := obj["${fieldName}"]; !exists {`)
				generator.pushLine(`\treturn nil, fmt.Errorf("%s: value does not contain required field '${fieldName}'", baseErrorMessage)`)
				generator.pushLine('}')
			}

			// Create instance with required fields
			if (requiredFields.length > 0) {
				const requiredArgs = requiredFields
					.map(([fieldName, field]) => {
						const deserializer = this.#buildDeserializer(
							field.type,
							`obj["${fieldName}"]`,
							`fmt.Sprintf("%s/${fieldName}", path)`
						)
						return `${camelCase(fieldName)}Deserialized`
					})
					.join(', ')

				// Deserialize required fields first
				for (const [fieldName, field] of requiredFields) {
					const varName = `${camelCase(fieldName)}Deserialized`
					generator.pushLine(
						`${varName}, err := ${this.#buildDeserializer(field.type, `obj["${fieldName}"]`, `fmt.Sprintf("%s/${fieldName}", path)`)}`
					)
					generator.pushLine('if err != nil {')
					generator.pushLine('\treturn nil, err')
					generator.pushLine('}')
				}

				// Convert required fields if needed
				const convertedArgs = []
				for (const [fieldName, field] of requiredFields) {
					const varName = `${camelCase(fieldName)}Deserialized`
					if (field.type.kind === 'number') {
						const goType = this.#buildType(field.type)
						const convertedVar = `${camelCase(fieldName)}Converted`
						generator.pushLine(`${convertedVar} := ${goType}(${varName})`)
						convertedArgs.push(convertedVar)
					} else {
						convertedArgs.push(varName)
					}
				}

				generator.pushLine(`result := New${structName}(${convertedArgs.join(', ')})`)
			} else {
				generator.pushLine(`result := New${structName}()`)
			}

			generator.pushLine()

			// Handle optional fields
			for (const [fieldName, field] of optionalFields) {
				const goFieldName = pascalCase(fieldName)
				generator.pushLine(`if val, exists := obj["${fieldName}"]; exists {`)
				generator.pushLine(
					`\tdeserialized, err := ${this.#buildDeserializer(field.type, 'val', `fmt.Sprintf("%s/${fieldName}", path)`)}`
				)
				generator.pushLine('\tif err != nil {')
				generator.pushLine('\t\treturn nil, err')
				generator.pushLine('\t}')
				if (field.type.kind === 'number') {
					const goType = this.#buildType(field.type)
					generator.pushLine(`\tconverted := ${goType}(deserialized)`)
					generator.pushLine(`\tresult.${goFieldName} = &converted`)
				} else if (field.type.kind === 'ref') {
					generator.pushLine(`\tresult.${goFieldName} = deserialized`)
				} else {
					generator.pushLine(`\tresult.${goFieldName} = &deserialized`)
				}
				generator.pushLine('}')
			}

			generator.pushLine()
			generator.pushLine('return result, nil')
		})
		generator.pushLine()
	}

	#buildSerializer(type: TypeDef, valueExpr: string): string {
		if (type.kind === 'ref') return `${valueExpr}.Serialize()`
		if (type.kind === 'list') {
			// For Go, we need to create a slice and serialize each element
			return `func() []any {
				result := make([]any, len(${valueExpr}))
				for i, v := range ${valueExpr} {
					result[i] = ${this.#buildSerializer(type.of, 'v')}
				}
				return result
			}()`
		}

		return valueExpr
	}

	#buildDeserializer(type: TypeDef, valueExpr: string, pathExpr: string): string {
		if (type.kind === 'string') return `deserializeString(${valueExpr}, ${pathExpr})`
		if (type.kind === 'number') return `deserializeNumber(${valueExpr}, ${pathExpr})`
		if (type.kind === 'boolean') return `deserializeBool(${valueExpr}, ${pathExpr})`
		if (type.kind === 'ref') return `${pascalCase(type.name)}Deserialize(${valueExpr}, ${pathExpr})`
		if (type.kind === 'list') {
			const itemDeserializer = this.#buildDeserializer(type.of, 'item', 'itemPath')
			return `deserializeList(${valueExpr}, ${pathExpr}, func(item any, itemPath string) (any, error) {
				return ${itemDeserializer}
			})`
		}

		throw new Error('Unknown type kind')
	}

	#buildType(type: TypeDef): string {
		if (type.kind === 'string') return 'string'
		if (type.kind === 'boolean') return 'bool'
		if (type.kind === 'list') return `[]${this.#buildType(type.of)}`
		if (type.kind === 'number') {
			// Map number behaviors to Go types
			if (type.behavior === 'u8') return 'uint8'
			if (type.behavior === 'u16') return 'uint16'
			if (type.behavior === 'u32') return 'uint32'
			if (type.behavior === 'u64') return 'uint64'
			if (type.behavior === 'i8') return 'int8'
			if (type.behavior === 'i16') return 'int16'
			if (type.behavior === 'i32') return 'int32'
			if (type.behavior === 'i64') return 'int64'
			if (type.behavior === 'f32') return 'float32'
			if (type.behavior === 'f64') return 'float64'
			return 'int' // default
		}
		if (type.kind === 'ref') return pascalCase(type.name)

		throw new Error('Unknown type kind')
	}

	#generateDocComment(generator: Generator, description: string) {
		const lines = description.trim().split('\n')

		for (const line of lines) {
			generator.pushLine(`// ${line}`)
		}
	}
}
