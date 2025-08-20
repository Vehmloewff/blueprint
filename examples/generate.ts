import { stat } from 'fs/promises'
import { readdir } from 'fs/promises'
import { Smith } from '~/smith'

for (const example of await readdir('examples')) {
	const meta = await stat(`examples/${example}`)
	if (!meta.isDirectory()) continue

	const { default: definition } = await import(`./${example}/definition.ts`)
	if (!(definition instanceof Smith)) throw new Error(`Definition for example ${example} is not an instance of Smith`)

	await Bun.file(`examples/${example}/code_generated.ts`).write(definition.generateTypescript())
}
