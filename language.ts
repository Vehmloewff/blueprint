import { Generator } from './generator'
import type { EnumBody, StructBody, TypeDef } from './type_def'

export type TypeInstance = TypeStructInstance | TypeEnumInstance

export type TypeStructInstance = {
	kind: 'struct'
	fieldName: string
	structName: string
}

export type TypeEnumInstance = {
	kind: 'enum'
	variantName: string
	enumName: string
}

export type CheckedItem = 'struct' | 'enum'

export type TypeAnalyzer = {
	getInstances(type: TypeDef): TypeInstance[]
	checkItem(name: string): CheckedItem | null
}

export type Language = {
	generateHeader?(generator: Generator): void
	generateEnum(generator: Generator, name: string, e: EnumBody): void
	generateStruct(generator: Generator, name: string, struct: StructBody): void
}
