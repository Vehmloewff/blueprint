# @emooring/blueprint

Generate Typescript, Go, or Rust structure builders from a single definition.

- Opiniated and beautiful. Resulting code is clean, readable, and a joy to use.
- Includes serialization and deserialization support. Data serialized in one language can be deserialized in another.
- Supports enums with values, similar to those in Rust.

## Usage

```ts
const b = new Blueprint()

b.struct('message', {
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
