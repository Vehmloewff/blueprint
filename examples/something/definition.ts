import { Smith } from '~/smith'

const smith = new Smith()

const someStruct = smith.struct('some_struct', {
	description: 'This is the struct',
	fields: {
		foo: { description: 'This is foo', type: smith.string(), required: true },
		bar: { description: 'This is the title', type: smith.number() },
	},
})

const someEnum = smith.enum('some_enum', {
	description: 'This is the enum',
	variants: {
		option1: { description: 'This is option 1', type: someStruct },
		option2: { description: 'This is option 2' },
	},
})

export const def = smith.struct('main_struct', {
	description: 'This is the main struct',
	fields: {
		title: { description: 'This is the title', type: smith.string() },
		something: { description: 'This is the title', type: someEnum },
	},
})
