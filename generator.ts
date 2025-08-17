export class StringBuilder {
	#string = ''

	add(text: string) {
		this.#string += text
	}

	get() {
		return this.#string
	}
}

export class Generator {
	#builder: StringBuilder
	#indentLevel = 0

	constructor(builder: StringBuilder, indentLevel: number) {
		this.#builder = builder
		this.#indentLevel = indentLevel
	}

	pushLine(text?: string) {
		if (text) {
			this.#builder.add('\t'.repeat(this.#indentLevel) + text + '\n')
		} else {
			this.#builder.add('\n')
		}
	}

	pushIn(text: string, indent: (generator: Generator) => void, trailing: string = '') {
		this.#builder.add('\t'.repeat(this.#indentLevel) + text + '{\n')
		indent(new Generator(this.#builder, this.#indentLevel + 1))
		this.#builder.add('\t'.repeat(this.#indentLevel) + `}\n`)
	}

	pushInTrailingComma(text: string, indent: (generator: Generator) => void) {
		this.pushIn(text, indent, ',')
	}
}
