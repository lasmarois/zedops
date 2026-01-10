package main

import (
	"encoding/json"
	"time"
)

// Message represents a NATS-inspired message
type Message struct {
	Subject   string      `json:"subject"`
	Reply     string      `json:"reply,omitempty"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp,omitempty"`
}

// NewMessage creates a new message with timestamp
func NewMessage(subject string, data interface{}) Message {
	return Message{
		Subject:   subject,
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
	}
}

// NewMessageWithReply creates a new message with reply inbox
func NewMessageWithReply(subject string, data interface{}, reply string) Message {
	return Message{
		Subject:   subject,
		Reply:     reply,
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
	}
}

// ToJSON serializes message to JSON
func (m Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

// FromJSON deserializes message from JSON
func FromJSON(data []byte) (*Message, error) {
	var msg Message
	err := json.Unmarshal(data, &msg)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

// RegisterRequest is the data structure for agent.register
type RegisterRequest struct {
	Token     string `json:"token"`
	AgentName string `json:"agentName"`
}

// RegisterResponse is the data structure for agent.register.success
type RegisterResponse struct {
	AgentID string `json:"agentId"`
	Token   string `json:"token"`
	Message string `json:"message"`
}

// ErrorResponse is the data structure for error messages
type ErrorResponse struct {
	Message string `json:"message"`
}
