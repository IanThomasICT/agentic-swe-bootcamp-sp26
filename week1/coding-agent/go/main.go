package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	dotenv "github.com/joho/godotenv"
	openai "github.com/openai/openai-go" // anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/openai/openai-go/option" // not needed with anthropic (uses ANTHROPIC_API_KEY env var)
	"github.com/openai/openai-go/shared" // not needed with anthropic (types are top-level)
	// "github.com/invopop/jsonschema"          // anthropic version uses this for GenerateSchema[T]()
)

// --- Agent ---

func main() {
	err := dotenv.Load("../.env")
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	client := openai.NewClient(
		option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
		option.WithBaseURL("https://openrouter.ai/api/v1"),
	)

	// Read stdin
	scanner := bufio.NewScanner(os.Stdin)
	getUserMessage := func() (string, bool) {
		if !scanner.Scan() {
			return "", false
		}
		return scanner.Text(), true
	}

	tools := []ToolDefinition{ReadFileDefinition, ListFilesDefinition, EditFileDefinition}
	agent := NewAgent(&client, getUserMessage, tools)

	// Go returns errors as values, so we can capture and print it if it exists
	err = agent.Run(context.TODO())
	if err != nil {
		fmt.Printf("Error: %s\n", err.Error())
	}
}

func NewAgent(client *openai.Client, getUserMessage func() (string, bool), tools []ToolDefinition) *Agent {
	return &Agent{
		client:         client,
		getUserMessage: getUserMessage,
		tools:          tools,
	}
}

type Agent struct {
	client         *openai.Client
	getUserMessage func() (string, bool)
	tools          []ToolDefinition
}

func (a *Agent) Run(ctx context.Context) error {
	conversation := []openai.ChatCompletionMessageParamUnion{} // []anthropic.MessageParam{}

	// Load AGENTS.md as system prompt if it exists
	if content, err := os.ReadFile("../AGENTS.md"); err == nil && len(strings.TrimSpace(string(content))) > 0 {
		conversation = append(conversation, openai.SystemMessage(string(content)))
	}

	fmt.Println("Chat with Agent (use 'ctrl-c' to quit)")

	// Build the tools param once
	// anthropic: []anthropic.ToolUnionParam with OfTool: &anthropic.ToolParam{Name, Description, InputSchema}
	chatTools := make([]openai.ChatCompletionToolParam, len(a.tools))
	for i, t := range a.tools {
		chatTools[i] = openai.ChatCompletionToolParam{
			Function: shared.FunctionDefinitionParam{ // anthropic.ToolParam
				Name:        t.Name,
				Description: openai.String(t.Description), // anthropic.String(t.Description)
				Parameters:  t.Parameters,                 // InputSchema: t.InputSchema
			},
		}
	}

	readUserInput := true
	for {
		if readUserInput {
			logger.User()
			userInput, ok := a.getUserMessage()
			if !ok {
				break
			}
			conversation = append(conversation, openai.UserMessage(userInput)) // anthropic.NewUserMessage(anthropic.NewTextBlock(userInput))
		}

		stopSpinner := logger.StartSpinner()

		params := openai.ChatCompletionNewParams{ // anthropic.MessageNewParams{
			Model:    "qwen/qwen3.6-plus:free", // anthropic.ModelClaude3_7SonnetLatest
			Messages: conversation,
			Tools:    chatTools, // Tools: anthropicTools
		}

		message, err := a.client.Chat.Completions.New(ctx, params) // a.client.Messages.New(ctx, anthropic.MessageNewParams{...})
		if err != nil {
			return err
		}
		stopSpinner()

		// Extract assistant message, content, and tool calls
		assistantMsg := message.Choices[0].Message                  // anthropic returns *anthropic.Message directly (no Choices)
		conversation = append(conversation, assistantMsg.ToParam()) // message.ToParam()
		content := assistantMsg.Content
		toolCalls := make([]openai.ChatCompletionMessageToolCall, len(assistantMsg.ToolCalls))
		copy(toolCalls, assistantMsg.ToolCalls)

		// Process tool calls
		// anthropic: iterate message.Content, check content.Type == "tool_use", use content.ID/content.Name/content.Input
		if len(toolCalls) > 0 { // anthropic: len(toolResults) > 0 after iterating message.Content
			for _, tc := range toolCalls {
				result := a.executeTool(tc.ID, tc.Function.Name, tc.Function.Arguments) // anthropic: content.ID, content.Name, content.Input
				conversation = append(conversation, result)
			}
			readUserInput = false
			continue
		}

		// Print text response with thinking support
		// anthropic: iterate message.Content, check content.Type == "text", print content.Text
		if content != "" {
			printThinkingAndResponse(content)
		}
		readUserInput = true
	}

	return nil
}

// anthropic signature: executeTool(id, name string, input json.RawMessage) anthropic.ContentBlockParamUnion
func (a *Agent) executeTool(id, name, argsJSON string) openai.ChatCompletionMessageParamUnion {
	var toolDef ToolDefinition
	var found bool
	for _, t := range a.tools {
		if t.Name == name {
			toolDef = t
			found = true
			break
		}
	}
	if !found {
		return openai.ToolMessage("tool not found", id) // anthropic.NewToolResultBlock(id, "tool not found", true)
	}

	logger.Tool(fmt.Sprintf("%s(%s)", name, argsJSON))

	response, err := toolDef.Function(json.RawMessage(argsJSON))
	if err != nil {
		return openai.ToolMessage(fmt.Sprintf("Error: %s", err.Error()), id) // anthropic.NewToolResultBlock(id, err.Error(), true)
	}
	return openai.ToolMessage(response, id) // anthropic.NewToolResultBlock(id, response, false)
}

// --- Logger ---

type Logger struct {
	useColor bool
}

func NewLogger() *Logger {
	useColor := os.Getenv("SHELL") != "" || os.Getenv("PSModulePath") != ""
	return &Logger{useColor: useColor}
}

func (l *Logger) format(label, color string) string {
	if l.useColor {
		return fmt.Sprintf("%s%s\x1b[0m", color, label)
	}
	return label
}

func (l *Logger) Agent(msg string) {
	fmt.Printf("%s: %s\n", l.format("Agent", "\x1b[94m"), msg)
}

func (l *Logger) User() {
	fmt.Printf("%s: ", l.format("User", "\x1b[97m"))
}

func (l *Logger) Tool(msg string) {
	fmt.Printf("%s: %s\n", l.format("Tool", "\x1b[32m"), msg)
}

func (l *Logger) Thinking(msg string) {
	if l.useColor {
		fmt.Printf("\x1b[3;90m%s\x1b[0m\n", msg) // italic grey
	} else {
		fmt.Printf("(thinking) %s\n", msg)
	}
}

func (l *Logger) StartSpinner() func() {
	stop := make(chan struct{})
	go func() {
		frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
		i := 0
		for {
			select {
			case <-stop:
				fmt.Print("\r\x1b[K")
				return
			default:
				fmt.Printf("\r%s", frames[i%len(frames)])
				i++
				time.Sleep(80 * time.Millisecond)
			}
		}
	}()
	return func() { close(stop) }
}

var logger = NewLogger()

func printThinkingAndResponse(content string) {
	thinkStart := strings.Index(content, "<think>")
	thinkEnd := strings.Index(content, "</think>")

	if thinkStart != -1 && thinkEnd != -1 && thinkEnd > thinkStart {
		thinking := strings.TrimSpace(content[thinkStart+7 : thinkEnd])
		answer := strings.TrimSpace(content[thinkEnd+8:])
		if thinking != "" {
			logger.Thinking(thinking)
		}
		if answer != "" {
			logger.Agent(answer)
		}
	} else {
		logger.Agent(content)
	}
}
