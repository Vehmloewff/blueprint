import { MainStruct, SomeStruct } from './code_generated'

const data = MainStruct.new().withTitle('Hi there').withSomething(SomeStruct.new('Big deal').withBar(40))
const json = JSON.stringify(data.serialize(), null, '\t')

console.log(json)

const data2 = MainStruct.deserialize(JSON.parse(json))
console.log(data2)
