import { Blueprint } from '~/blueprint'

const b = new Blueprint()

const someStruct = b.struct('some_struct', () => ({
	description: 'This is the struct',
	fields: {
		foo: { description: 'This is foo', type: b.string(), required: true },
		bar: { description: 'This is the title', type: b.number() },
	},
}))

const someEnum = b.enum('some_enum', () => ({
	description: 'This is the enum',
	variants: {
		option1: { description: 'This is option 1', type: someStruct },
		option2: { description: 'This is option 2' },
	},
}))

b.struct('main_struct', () => ({
	description: 'This is the main struct',
	fields: {
		title: { description: 'This is the title', type: b.string() },
		something: { description: 'This is the title', type: someEnum },
	},
}))

export default b
