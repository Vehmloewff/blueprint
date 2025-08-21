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

func deserializeNumber(value interface{}, path string) (float64, error) {
	num, ok := value.(float64)
	if !ok {
		return 0, fmt.Errorf("failed to deserialize into number at %s: value is not a number", path)
	}
	return num, nil
}



// This is the struct
type SomeStruct struct {
	// This is foo
	Foo string `json:"foo"`
	// This is the title
	Bar *int32 `json:"bar,omitempty"`
}

// Creates a new SomeStruct with required fields
func NewSomeStruct(foo string) *SomeStruct {
	return &SomeStruct{
		Foo: foo,
	}
}

// This is foo
func (s *SomeStruct) WithFoo(foo string) *SomeStruct {
	s.Foo = foo
	return s
}

// This is the title
func (s *SomeStruct) WithBar(bar int32) *SomeStruct {
	s.Bar = &bar
	return s
}

// Converts this SomeStruct into a SomeEnum
func (s *SomeStruct) IntoSomeEnum() *SomeEnum {
	return SomeEnumOption1(*s)
}

// Serializes the SomeStruct to a map for JSON encoding
func (s *SomeStruct) Serialize() map[string]interface{} {
	result := make(map[string]interface{})

	result["foo"] = s.Foo
	if s.Bar != nil {
		result["bar"] = *s.Bar
	}

	return result
}

// Deserializes a map into a SomeStruct
func SomeStructDeserialize(value interface{}, path string) (*SomeStruct, error) {
	if path == "" {
		path = "#"
	}
	baseErrorMessage := fmt.Sprintf("failed to deserialize into 'some_struct' at '%s'", path)
	obj, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("%s: value is not an object", baseErrorMessage)
	}

	if _, exists := obj["foo"]; !exists {
		return nil, fmt.Errorf("%s: value does not contain required field 'foo'", baseErrorMessage)
	}
	fooDeserialized, err := deserializeString(obj["foo"], fmt.Sprintf("%s/foo", path))
	if err != nil {
		return nil, err
	}
	result := NewSomeStruct(fooDeserialized)

	if val, exists := obj["bar"]; exists {
		deserialized, err := deserializeNumber(val, fmt.Sprintf("%s/bar", path))
		if err != nil {
			return nil, err
		}
		converted := int32(deserialized)
		result.Bar = &converted
	}

	return result, nil
}



// Interface for types that can convert into SomeEnum
type IntoSomeEnum interface {
	IntoSomeEnum() *SomeEnum
}

// This is the enum
type SomeEnum struct {
	// This is option 1
	Option1 *SomeStruct `json:"option1,omitempty"`
	// This is option 2
	Option2 *struct{} `json:"option2,omitempty"`
}

// Creates a SomeEnum from an IntoSomeEnum or returns the existing SomeEnum
func SomeEnumFrom(thing interface{}) *SomeEnum {
	if enum, ok := thing.(*SomeEnum); ok {
		return enum
	}
	if converter, ok := thing.(IntoSomeEnum); ok {
		return converter.IntoSomeEnum()
	}
	return nil
}

// This is option 1
func SomeEnumOption1(value SomeStruct) *SomeEnum {
	return &SomeEnum{
		Option1: &value,
	}
}

// This is option 2
func SomeEnumOption2() *SomeEnum {
	return &SomeEnum{
		Option2: &struct{}{},
	}
}

// Serializes the SomeEnum to a map for JSON encoding
func (e *SomeEnum) Serialize() map[string]interface{} {
	result := make(map[string]interface{})

	if e.Option1 != nil {
		result["option1"] = e.Option1.Serialize()
	}
	if e.Option2 != nil {
		result["option2"] = struct{}{}
	}

	return result
}

// Deserializes a map into a SomeEnum
func SomeEnumDeserialize(value interface{}, path string) (*SomeEnum, error) {
	baseErrorMessage := fmt.Sprintf("failed to deserialize into 'some_enum' at '%s'", path)
	obj, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("%s: value is not an object", baseErrorMessage)
	}

	result := &SomeEnum{}

	if _, exists := obj["option1"]; exists {
		deserialized, err := SomeStructDeserialize(obj["option1"], fmt.Sprintf("%s/option1", path))
		if err != nil {
			return nil, err
		}
		result.Option1 = deserialized
	} else if _, exists := obj["option2"]; exists {
		result.Option2 = &struct{}{}
	} else {
		return nil, fmt.Errorf("%s: value does not contain any recognized variants", baseErrorMessage)
	}

	return result, nil
}



// This is the main struct
type MainStruct struct {
	// This is the title
	Title *string `json:"title,omitempty"`
	// This is the title
	Something *SomeEnum `json:"something,omitempty"`
}

// Creates a new MainStruct
func NewMainStruct() *MainStruct {
	return &MainStruct{}
}

// This is the title
func (s *MainStruct) WithTitle(title string) *MainStruct {
	s.Title = &title
	return s
}

// This is the title
func (s *MainStruct) WithSomething(something interface{}) *MainStruct {
	s.Something = SomeEnumFrom(something)
	return s
}

// Serializes the MainStruct to a map for JSON encoding
func (s *MainStruct) Serialize() map[string]interface{} {
	result := make(map[string]interface{})

	if s.Title != nil {
		result["title"] = *s.Title
	}
	if s.Something != nil {
		result["something"] = s.Something.Serialize()
	}

	return result
}

// Deserializes a map into a MainStruct
func MainStructDeserialize(value interface{}, path string) (*MainStruct, error) {
	if path == "" {
		path = "#"
	}
	baseErrorMessage := fmt.Sprintf("failed to deserialize into 'main_struct' at '%s'", path)
	obj, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("%s: value is not an object", baseErrorMessage)
	}

	result := NewMainStruct()

	if val, exists := obj["title"]; exists {
		deserialized, err := deserializeString(val, fmt.Sprintf("%s/title", path))
		if err != nil {
			return nil, err
		}
		result.Title = &deserialized
	}
	if val, exists := obj["something"]; exists {
		deserialized, err := SomeEnumDeserialize(val, fmt.Sprintf("%s/something", path))
		if err != nil {
			return nil, err
		}
		result.Something = deserialized
	}

	return result, nil
}

