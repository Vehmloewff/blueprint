import { stat } from 'fs/promises'
import { readdir } from 'fs/promises'
import { Blueprint } from '~/blueprint'

for (const example of await readdir('examples')) {
	const meta = await stat(`examples/${example}`)
	if (!meta.isDirectory()) continue

	const { default: definition } = await import(`./${example}/definition.ts`)
	if (!(definition instanceof Blueprint)) throw new Error(`Definition for example ${example} is not an instance of Blueprint`)

	await Bun.file(`examples/${example}/code_generated.ts`).write(definition.generateTypescript())
	await Bun.file(`examples/${example}/code_generated.go`).write(definition.generateGo())
	await Bun.file(`examples/${example}/code_generated.rs`).write(definition.generateRust())
}
