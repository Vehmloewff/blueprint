import { readdir } from 'fs/promises'
import { Smith } from './smith'

for (const example of await readdir('examples')) {
	const { default: definition } = await import(`./examples/${example}/definition.ts`)
	if (!(definition instanceof Smith)) throw new Error(`Definition for example ${example} is not an instance of Smith`)

	await Bun.file(`examples/${example}/code_generated.ts`).write(definition.generateTypescript())
}
