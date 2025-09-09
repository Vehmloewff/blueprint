import { build } from 'bun'
import dts from 'bun-plugin-dts'
import { peerDependencies } from './package.json'

await build({
	entrypoints: ['./index.ts'],
	outdir: './dist',
	plugins: [dts()],
	external: Object.keys(peerDependencies),
	format: 'esm',
})
