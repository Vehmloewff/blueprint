import { pascalCase, snakeCase } from 'change-case'
import type { Generator } from './generator'
import type { Language } from './language'
import type { EnumBody, StructBody, TypeDef } from './type_def'

function id(text: string) {
	return text
}

export class Typescript implements Language {
	generateEnum(generator: Generator, name: string, e: EnumBody): void {
		const isTagged = Object.values(e.variants).find(variant => variant.fields !== undefined)
		const enumName = pascalCase(name)
		const variantName = (variant: string) => pascalCase(`${name}_${variant}`)

		if (isTagged) {
			for (const [name, variant] of Object.entries(e.variants)) {
				this.generateStruct(generator, `${name}_${variant}`, {
					description: variant.description,
					fields: variant.fields ?? {},
				})

				generator.pushLine()
				generator.pushLine()
			}
		}

		this.#generateDocComment(generator, e.description)
		generator.pushIn(`export type ${enumName} = `, generator => {
			for (const [name, variant] of Object.entries(e.variants)) {
				this.#generateDocComment(generator, variant.description)

				if (isTagged) {
					generator.pushLine(`${name}?: ${variantName(name)},`)
				} else {
					generator.pushLine(`| '${pascalCase(name)}'`)
				}
			}
		})

		generator.pushLine()
		generator.pushLine()

		this.#generateDocComment(generator, e.description)
		generator.pushIn(`export const ${enumName} = `, generator => {
			for (const [name, variant] of Object.entries(e.variants)) {
				this.#generateDocComment(generator, variant.description)

				if (isTagged) {
					generator.pushInTrailingComma(`${snakeCase(name)}(info: ${variantName(name)}): ${enumName} `, generator => {
						generator.pushLine(`return { ${name}: info }`)
					})
				} else {
					generator.pushLine(`${snakeCase(name)}: '${name}',`)
				}
			}
		})
	}

	generateStruct(generator: Generator, name: string, struct: StructBody) {}

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
