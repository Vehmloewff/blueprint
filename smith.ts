import { Generator, StringBuilder } from './generator'
import type { Language } from './language'
import type { BooleanDef, EnumBody, ListDef, NumberBehavior, NumberDef, RefDef, StringDef, StructBody, TypeDef } from './type_def'
import { Typescript } from './typescript'

type RefItem = Struct | Enum
type Struct = { kind: 'struct' } & StructBody
type Enum = { kind: 'enum' } & EnumBody

export class Smith {
	#items = new Map<string, RefItem>()

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
		return this.generate(new Typescript())
	}
}
