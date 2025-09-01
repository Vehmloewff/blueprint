import { readdir, stat } from 'fs/promises'
import { describe, expect, it } from 'bun:test'
import { Blueprint } from '~/blueprint'

describe('examples', async () => {
	for (const example of await readdir('examples')) {
		const meta = await stat(`examples/${example}`)
		if (!meta.isDirectory()) continue

		const { default: definition } = await import(`./${example}/definition.ts`)
		if (!(definition instanceof Blueprint)) throw new Error(`Definition for example ${example} is not an instance of Blueprint`)

		it(`${example} [typescript]`, async () => {
			const ts = definition.generateTypescript()
			const expectedTs = await Bun.file(`examples/${example}/code_generated.ts`).text()

			expect(ts).toEqual(expectedTs)
		})

		it(`${example} [go]`, async () => {
			const go = definition.generateGo()
			const expectedGo = await Bun.file(`examples/${example}/code_generated.go`).text()

			expect(go).toEqual(expectedGo)
		})

		it(`${example} [rust]`, async () => {
			const rust = definition.generateRust()
			const expectedRust = await Bun.file(`examples/${example}/code_generated.rs`).text()

			expect(rust).toEqual(expectedRust)
		})
	}
})
