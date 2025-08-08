export type NumberBehavior = 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64' | 'f32' | 'f64'

export type TypeDef = RefDef | NumberDef | StringDef | BooleanDef | ListDef

export type RefDef = { kind: 'ref'; name: string }
export type NumberDef = { kind: 'number'; behavior: NumberBehavior }
export type StringDef = { kind: 'string' }
export type BooleanDef = { kind: 'boolean' }
export type ListDef = { kind: 'list'; of: TypeDef }

export type StructField = TypeDef & { description: string; required?: boolean }
export type EnumVariant = { description: string; fields?: StructFields }
export type StructFields = Record<string, StructField>

export type StructBody = {
	description: string
	fields: StructFields
}

export type EnumBody = {
	description: string
	variants: Record<string, EnumVariant>
}
