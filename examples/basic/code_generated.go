package main

import (
	"fmt"
)

func deserializeString(value interface{}, path string) (string, error) {
	str, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("failed to deserialize into string at %s: value is not a string", path)
	}
	return str, nil
}



// Interface for types that can convert into MessageIntent
type IntoMessageIntent interface {
	IntoMessageIntent() *MessageIntent
}

// Message intents are the primary way to categorize messages.
type MessageIntent struct {
	// Create a new entity
	Create *struct{} `json:"create,omitempty"`
	// Delete an entity
	Delete *struct{} `json:"delete,omitempty"`
}

// Creates a MessageIntent from an IntoMessageIntent or returns the existing MessageIntent
func MessageIntentFrom(thing interface{}) *MessageIntent {
	if enum, ok := thing.(*MessageIntent); ok {
		return enum
	}
	if converter, ok := thing.(IntoMessageIntent); ok {
		return converter.IntoMessageIntent()
	}
	return nil
}

// Create a new entity
func MessageIntentCreate() *MessageIntent {
	return &MessageIntent{
		Create: &struct{}{},
	}
}

// Delete an entity
func MessageIntentDelete() *MessageIntent {
	return &MessageIntent{
		Delete: &struct{}{},
	}
}

// Serializes the MessageIntent to a map for JSON encoding
func (e *MessageIntent) Serialize() map[string]interface{} {
	result := make(map[string]interface{})

	if e.Create != nil {
		result["create"] = struct{}{}
	}
	if e.Delete != nil {
		result["delete"] = struct{}{}
	}

	return result
}

// Deserializes a map into a MessageIntent
func MessageIntentDeserialize(value interface{}, path string) (*MessageIntent, error) {
	baseErrorMessage := fmt.Sprintf("failed to deserialize into 'message_intent' at '%s'", path)
	obj, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("%s: value is not an object", baseErrorMessage)
	}

	result := &MessageIntent{}

	if _, exists := obj["create"]; exists {
		result.Create = &struct{}{}
	} else if _, exists := obj["delete"]; exists {
		result.Delete = &struct{}{}
	} else {
		return nil, fmt.Errorf("%s: value does not contain any recognized variants", baseErrorMessage)
	}

	return result, nil
}



// A message that can be sent between processes
type Message struct {
	// The id of the message that can be sent
	Id string `json:"id"`
	// The intention of the message. Should be present unless it is a ping.
	Intent *MessageIntent `json:"intent,omitempty"`
}

// Creates a new Message with required fields
func NewMessage(id string) *Message {
	return &Message{
		Id: id,
	}
}

// The id of the message that can be sent
func (s *Message) WithId(id string) *Message {
	s.Id = id
	return s
}

// The intention of the message. Should be present unless it is a ping.
func (s *Message) WithIntent(intent interface{}) *Message {
	s.Intent = MessageIntentFrom(intent)
	return s
}

// Serializes the Message to a map for JSON encoding
func (s *Message) Serialize() map[string]interface{} {
	result := make(map[string]interface{})

	result["id"] = s.Id
	if s.Intent != nil {
		result["intent"] = s.Intent.Serialize()
	}

	return result
}

// Deserializes a map into a Message
func MessageDeserialize(value interface{}, path string) (*Message, error) {
	if path == "" {
		path = "#"
	}
	baseErrorMessage := fmt.Sprintf("failed to deserialize into 'message' at '%s'", path)
	obj, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("%s: value is not an object", baseErrorMessage)
	}

	if _, exists := obj["id"]; !exists {
		return nil, fmt.Errorf("%s: value does not contain required field 'id'", baseErrorMessage)
	}
	idDeserialized, err := deserializeString(obj["id"], fmt.Sprintf("%s/id", path))
	if err != nil {
		return nil, err
	}
	result := NewMessage(idDeserialized)

	if val, exists := obj["intent"]; exists {
		deserialized, err := MessageIntentDeserialize(val, fmt.Sprintf("%s/intent", path))
		if err != nil {
			return nil, err
		}
		result.Intent = deserialized
	}

	return result, nil
}

