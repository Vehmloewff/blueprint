# @emooring/blueprint

Generate Typescript, Go, or Rust structure builders from a single definition.

- Opiniated and beautiful. Resulting code is clean, readable, and a joy to use.
- Includes serialization and deserialization support. Data serialized in one language can be deserialized in another.
- Supports enums with values, similar to those in Rust.

## Usage

```ts
const b = new Blueprint()

b.struct('message', () => {
	description: 'A message that can be sent between processes',
	fields: {
		id: { description: 'The id of the message that can be sent', type: b.string(), required: true },
		intent: {
			description: 'The intention of the message. Should be present unless it is a ping.',
			type: b.enum('message_intent', {
				description: 'Message intents are the primary way to categorize messages.',
				variants: {
					create: { description: 'Create a new entity' },
					delete: { description: 'Delete an entity' },
				},
			}),
		},
	},
})

b.generateTypescript() // `export class Message { ...`
b.generateGo() // `type Message struct { ...`
b.generateRust() // `pub struct Message { ...`
```

See the subfolders in the `examples` directory for further examples.

## Contributing

Requires `bun` to be installed.

If making general changes, `bun test` is your friend.

If adding support for a new language...

- create a new class implements the `Language` interface
- add a `generate*()` method to `Blueprint` that generates code for the language by calling `this.generate(new WhateverYourNewLanguageIs())`
- add support for the language in `examples/main.test.ts` and `examples/generate.ts`
- run `bun examples` to generate code for the new language based on existing examples
