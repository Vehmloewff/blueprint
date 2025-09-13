import { Blueprint } from '~/blueprint'

const b = new Blueprint()

b.struct('message', () => ({
	description: 'A message that can be sent between processes',
	fields: {
		id: { description: 'The id of the message that can be sent', type: b.string(), required: true },
		intent: {
			description: 'The intention of the message. Should be present unless it is a ping.',
			type: b.enum('message_intent', () => ({
				description: 'Message intents are the primary way to categorize messages.',
				variants: {
					create: { description: 'Create a new entity' },
					delete: { description: 'Delete an entity' },
				},
			})),
		},
	},
}))

export default b
