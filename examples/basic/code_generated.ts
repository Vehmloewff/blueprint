function deserializeString(value: unknown, path: string) {
	if (typeof value !== 'string') throw new Error(`failed to deserialize into string at ${path}: value is not a string`)

	return value
}


export interface IntoMessageIntent {
	intoMessageIntent(): MessageIntent
}


/** Message intents are the primary way to categorize messages. */
export class MessageIntent {
	/** Create a new entity */
	create?: {}
	/** Delete an entity */
	delete?: {}

	static from(thing: IntoMessageIntent | MessageIntent) {
		if (thing instanceof MessageIntent) return thing

		return thing.intoMessageIntent()
	}

	/** Create a new entity */
	static create() {
		const e = new MessageIntent()
		e.create = {}

		return e
	}

	/** Delete an entity */
	static delete() {
		const e = new MessageIntent()
		e.delete = {}

		return e
	}

	serialize() {
		const value: Record<string, unknown> = {}

		if (this.create !== undefined) value.create = {}
		if (this.delete !== undefined) value.delete = {}

		return value
	}

	static deserialize(value: unknown, path: string) {
		const baseErrorMessage = `failed to deserialize into 'message_intent' at '${path}'`
		if (!value || typeof value !== 'object') throw new Error(`${baseErrorMessage}: value is not an object.`)

		const self = new MessageIntent()

		if ('create' in value) {
			self.create = {}
		}
		else if ('delete' in value) {
			self.delete = {}
		}
		else throw new Error(`${baseErrorMessage}: value does not contain any recognized variants.`)

		return self
	}
}


/** A message that can be sent between processes */
export class Message {
	/** The id of the message that can be sent */
	id: string
	/** The intention of the message. Should be present unless it is a ping. */
	intent?: MessageIntent

	/**
	 * A message that can be sent between processes
	 * 
	 *  - `id`: The id of the message that can be sent */
	constructor(id: string) {
		this.id = id
	}

	/**
	 * A message that can be sent between processes
	 * 
	 *  - `id`: The id of the message that can be sent */
	static new(id: string) {
		return new this(id)
	}

	/** The id of the message that can be sent */
	withId(id: string) {
		this.id = id

		return this
	}

	/** The intention of the message. Should be present unless it is a ping. */
	withIntent(intent: IntoMessageIntent | MessageIntent) {
		this.intent = MessageIntent.from(intent)

		return this
	}

	serialize(): unknown {
		const serialized: Record<string, unknown> = {}

		if (this.id !== undefined) serialized.id = this.id
		if (this.intent !== undefined) serialized.intent = this.intent.serialize()

		return serialized
	}

	static deserialize(value: unknown, path: string = '#') {
		const baseErrorMessage = `failed to deserialize into 'message' at '${path}'`
		if (!value || typeof value !== 'object') throw new Error(`${baseErrorMessage}: value is not an object.`)

		if (!('id' in value)) throw new Error(`${baseErrorMessage}: value does not contain required field 'id'.`)
		const self = new this(deserializeString(value.id, `${path}/id`))

		if ('intent' in value) self.intent = MessageIntent.deserialize(value.intent, `${path}/intent`)

		return self
	}
}
