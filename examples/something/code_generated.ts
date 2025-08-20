function deserializeString(value: unknown, path: string) {
	if (typeof value !== 'string') throw new Error(`failed to deserialize into string at ${path}: value is not a string`)

	return value
}

function deserializeNumber(value: unknown, path: string) {
	if (typeof value !== 'number') throw new Error(`failed to deserialize into number at ${path}: value is not a number`)

	return value
}

function deserializeBool(value: unknown, path: string) {
	if (typeof value !== 'boolean') throw new Error(`failed to deserialize into boolean at ${path}: value is not a boolean`)

	return value
}

export class SomeStruct implements IntoSomeEnum {
	foo: string
	bar?: number

	constructor(foo: string) {
		this.foo = foo
	}

	static new(foo: string) {
		return new this(foo)
	}

	withFoo(foo: string) {
		this.foo = foo
		return this
	}

	withBar(bar: number) {
		this.bar = bar
		return this
	}

	intoSomeEnum() {
		return SomeEnum.option1(this)
	}

	serialize(): unknown {
		return { foo: this.foo, bar: this.bar }
	}

	static deserialize(value: unknown, path: string) {
		const baseErrorMessage = `failed to deserialize into 'some_struct' at '${path}'`
		if (!value || typeof value !== 'object') throw new Error(`${baseErrorMessage}: value is not an object.`)

		if (!('foo' in value)) throw new Error(`${baseErrorMessage}: value does not contain required field 'foo'.`)
		const self = new this(deserializeString(value.foo, `${path}->foo`))

		if ('bar' in value) self.bar = deserializeNumber(value.bar, `${path}->bar`)

		return self
	}
}

export interface IntoSomeEnum {
	intoSomeEnum(): SomeEnum
}

export class SomeEnum {
	option1?: SomeStruct
	option2?: {}

	static from(thing: IntoSomeEnum | SomeEnum) {
		if (thing instanceof SomeEnum) return thing

		return thing.intoSomeEnum()
	}

	static option1(value: SomeStruct) {
		const e = new SomeEnum()
		e.option1 = value

		return e
	}

	static option2() {
		const e = new SomeEnum()
		e.option2 = {}

		return e
	}

	serialize() {
		const value: Record<string, unknown> = {}

		if (this.option1) value.option1 = this.option1.serialize()
		if (this.option2) value.option2 = this.option2

		return value
	}

	static deserialize() {
		// TODO
	}
}

export class MainStruct {
	title?: string
	something?: SomeEnum

	static new() {
		return new this()
	}

	withTitle(title: string) {
		this.title = title

		return this
	}

	withSomething(something: IntoSomeEnum | SomeEnum) {
		this.something = SomeEnum.from(something)

		return this
	}

	serialize() {
		// TODO
	}

	static deserialize(value: unknown) {
		// TODO
	}
}
