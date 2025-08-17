import { describe, expect, it } from 'bun:test'
import { Smith } from './smith'

describe('TypeScript', () => {
	it('should generate TypeScript code', () => {
		const smith = new Smith()

		smith.enum('hello', {
			description: 'Hello, world!',
			variants: {
				hello: {
					description: 'This is the hello part',
					fields: {
						hello: { description: 'the hello in hello', type: smith.boolean() },
						world: { description: 'the world in hello', type: smith.number('f64') },
					},
				},
				world: {
					description: 'This is the world part',
					fields: {
						world1: { description: 'world 1 is earth', type: smith.string() },
						world2: {
							description: 'world 2 is mars',
							type: smith.struct('Mars', {
								description: 'Mars is a planet',
								fields: {
									is_real: { description: 'is mars real', type: smith.boolean() },
								},
							}),
						},
					},
				},
			},
		})

		expect(smith.generateTypescript()).toBe(`

/** Mars is a planet */
export type Mars = {
	/** is mars real */
	is_real: boolean,
}


/** This is the hello part */
export type HelloHello = {
	/** the hello in hello */
	hello: boolean,
	/** the world in hello */
	world: number,
}


/** This is the world part */
export type HelloWorld = {
	/** world 1 is earth */
	world1: string,
	/** world 2 is mars */
	world2: Mars,
}


/** Hello, world! */
export type Hello = {
	/** This is the hello part */
	hello?: HelloHello,
	/** This is the world part */
	world?: HelloWorld,
}


/** Hello, world! */
export const Hello = {
	/** This is the hello part */
	hello(info: HelloHello): Hello {
		return { hello: info }
	}
	/** This is the world part */
	world(info: HelloWorld): Hello {
		return { world: info }
	}
}
`)
	})
})
