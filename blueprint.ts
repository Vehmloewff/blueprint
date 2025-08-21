import { Generator, StringBuilder } from './generator'
import type { CheckedItem, Language, TypeAnalyzer, TypeInstance } from './language'
import type { BooleanDef, EnumBody, ListDef, NumberBehavior, NumberDef, RefDef, StringDef, StructBody, TypeDef } from './type_def'
import { Typescript } from './typescript'
import { Golang } from './golang'

type RefItem = Struct | Enum
type Struct = { kind: 'struct' } & StructBody
type Enum = { kind: 'enum' } & EnumBody

type ItemMap = Map<string, RefItem>

export class Blueprint {
	#items: ItemMap = new Map()

	string(): StringDef {
		return { kind: 'string' }
	}

	number(behavior: NumberBehavior = 'i32'): NumberDef {
		return { kind: 'number', behavior }
	}

	boolean(): BooleanDef {
		return { kind: 'boolean' }
	}

	list(of: TypeDef): ListDef {
		return { kind: 'list', of }
	}

	struct(name: string, body: StructBody): RefDef {
		this.#items.set(name, { kind: 'struct', ...body })

		return { kind: 'ref', name }
	}

	enum(name: string, e: EnumBody): RefDef {
		this.#items.set(name, { kind: 'enum', ...e })

		return { kind: 'ref', name }
	}

	generate(language: Language) {
		const builder = new StringBuilder()
		const generator = new Generator(builder, 0)

		if (language.generateHeader) {
			language.generateHeader(generator)
		}

		for (const [name, item] of this.#items.entries()) {
			generator.pushLine()
			generator.pushLine()

			if (item.kind === 'enum') language.generateEnum(generator, name, item)
			if (item.kind === 'struct') language.generateStruct(generator, name, item)
		}

		return builder.get()
	}

	generateTypescript() {
		return this.generate(new Typescript(new BlueprintAnalyzer(this.#items)))
	}

	generateGo() {
		return this.generate(new Golang(new BlueprintAnalyzer(this.#items)))
	}
}

class BlueprintAnalyzer implements TypeAnalyzer {
	#items: ItemMap

	constructor(items: ItemMap) {
		this.#items = items
	}

	checkItem(name: string): CheckedItem | null {
		const item = this.#items.get(name)

		if (!item) return null

		return item.kind
	}

	getInstances(type: TypeDef): TypeInstance[] {
		const instances: TypeInstance[] = []

		for (const [itemName, item] of this.#items) {
			if (item.kind === 'enum') {
				for (const [variantName, variant] of Object.entries(item.variants)) {
					if (variant.type && this.#doesTypeMatch(variant.type, type)) {
						instances.push({ kind: 'enum', enumName: itemName, variantName })
					}
				}
			}

			if (item.kind === 'struct') {
				for (const [fieldName, field] of Object.entries(item.fields)) {
					if (field.type && this.#doesTypeMatch(field.type, type)) {
						instances.push({ kind: 'struct', structName: itemName, fieldName })
					}
				}
			}
		}

		return instances
	}

	#doesTypeMatch(base: TypeDef, match: TypeDef): boolean {
		if (base.kind === 'boolean' && match.kind === 'boolean') return true
		if (base.kind === 'number' && match.kind === 'number') {
			if (base.behavior === match.behavior || match.behavior === undefined) return true
		}
		if (base.kind === 'string' && match.kind === 'string') return true
		if (base.kind === 'list' && match.kind === 'list' && this.#doesTypeMatch(base.of, match.of)) return true
		if (base.kind === 'ref' && match.kind === 'ref' && base.name === match.name) return true
		if (match.kind === 'unknown') return true

		return false
	}
}
