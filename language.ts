import { StringBuilder, Generator } from './generator'
import type { EnumBody, StructBody } from './type_def'

export type Language = {
	generateHeader?(generator: Generator): void
	analyze?(items: Map<string, { kind: 'struct' | 'enum'; body: StructBody | EnumBody }>): void
	generateEnum(generator: Generator, name: string, e: EnumBody): void
	generateStruct(generator: Generator, name: string, struct: StructBody): void
}
