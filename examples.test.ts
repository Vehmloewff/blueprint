import { readdir } from 'fs/promises'
import { describe, expect, it } from 'bun:test'
import { Smith } from './smith'

describe('examples', async () => {
	for (const example of await readdir('examples')) {
		const { default: definition } = await import(`./examples/${example}/definition.ts`)
		if (!(definition instanceof Smith)) throw new Error(`Definition for example ${example} is not an instance of Smith`)

		it(`${example} [typescript]`, async () => {
			const ts = definition.generateTypescript()
			const expectedTs = await Bun.file(`examples/${example}/code_generated.ts`).text()

			expect(ts).toEqual(expectedTs)
		})
	}
})
