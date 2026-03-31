package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	dotenv "github.com/joho/godotenv"
	openai "github.com/openai/openai-go" // anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/openai/openai-go/option" // not needed with anthropic (uses ANTHROPIC_API_KEY env var)
	"github.com/openai/openai-go/shared" // not needed with anthropic (types are top-level)
	// "github.com/invopop/jsonschema"          // anthropic version uses this for GenerateSchema[T]()
)

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

var logger = NewLogger()

// --- Tool Definitions ---

type ToolDefinition struct {
	Name        string
	Description string
	Parameters  shared.FunctionParameters                   // anthropic.ToolInputSchemaParam -> openai shared.FunctionParameters
	Function    func(input json.RawMessage) (string, error) // same signature in both
}

// read_file

var ReadFileDefinition = ToolDefinition{
	Name:        "read_file",
	Description: "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
	Parameters: shared.FunctionParameters{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "The relative path of a file in the working directory.",
			},
		},
		"required": []string{"path"},
	},
	Function: ReadFile,
}

type ReadFileInput struct {
	Path string `json:"path"`
}

func ReadFile(input json.RawMessage) (string, error) {
	var ri ReadFileInput
	if err := json.Unmarshal(input, &ri); err != nil {
		return "", err
	}

	content, err := os.ReadFile(ri.Path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// list_files

var ListFilesDefinition = ToolDefinition{
	Name:        "list_files",
	Description: "List files and directories at a given path. If no path is provided, lists files in the current directory.",
	Parameters: shared.FunctionParameters{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Optional relative path to list files from. Defaults to current directory if not provided.",
			},
		},
	},
	Function: ListFiles,
}

type ListFilesInput struct {
	Path string `json:"path,omitempty"`
}

func ListFiles(input json.RawMessage) (string, error) {
	var li ListFilesInput
	if err := json.Unmarshal(input, &li); err != nil {
		return "", err
	}

	dir := "."
	if li.Path != "" {
		dir = li.Path
	}

	var files []string
	err := filepath.Walk(dir, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relPath, err := filepath.Rel(dir, p)
		if err != nil {
			return err
		}
		if relPath != "." {
			if info.IsDir() {
				files = append(files, relPath+"/")
			} else {
				files = append(files, relPath)
			}
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	result, err := json.Marshal(files)
	if err != nil {
		return "", err
	}
	return string(result), nil
}

// edit_file

var EditFileDefinition = ToolDefinition{
	Name: "edit_file",
	Description: `Make edits to a text file.

Replaces 'old_str' with 'new_str' in the given file. 'old_str' and 'new_str' MUST be different from each other.

If the file specified with path doesn't exist, it will be created.`,
	Parameters: shared.FunctionParameters{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "The path to the file",
			},
			"old_str": map[string]any{
				"type":        "string",
				"description": "Text to search for - must match exactly and must only have one match exactly",
			},
			"new_str": map[string]any{
				"type":        "string",
				"description": "Text to replace old_str with",
			},
		},
		"required": []string{"path", "old_str", "new_str"},
	},
	Function: EditFile,
}

type EditFileInput struct {
	Path   string `json:"path"`
	OldStr string `json:"old_str"`
	NewStr string `json:"new_str"`
}

func EditFile(input json.RawMessage) (string, error) {
	var ei EditFileInput
	if err := json.Unmarshal(input, &ei); err != nil {
		return "", err
	}

	if ei.Path == "" || ei.OldStr == ei.NewStr {
		return "", fmt.Errorf("invalid input parameters")
	}

	content, err := os.ReadFile(ei.Path)
	if err != nil {
		if os.IsNotExist(err) && ei.OldStr == "" {
			return createNewFile(ei.Path, ei.NewStr)
		}
		return "", err
	}

	oldContent := string(content)
	newContent := strings.Replace(oldContent, ei.OldStr, ei.NewStr, -1)

	if oldContent == newContent && ei.OldStr != "" {
		return "", fmt.Errorf("old_str not found in file")
	}

	if err := os.WriteFile(ei.Path, []byte(newContent), 0644); err != nil {
		return "", err
	}
	return "OK", nil
}

func createNewFile(filePath, content string) (string, error) {
	dir := path.Dir(filePath)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return "", fmt.Errorf("failed to create directory: %w", err)
		}
	}

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	return fmt.Sprintf("Successfully created file %s", filePath), nil
}

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

		message, err := a.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{ // a.client.Messages.New(ctx, anthropic.MessageNewParams{
			Model:    "qwen/qwen3.6-plus-preview:free", // anthropic.ModelClaude3_7SonnetLatest
			Messages: conversation,
			Tools:    chatTools, // Tools: anthropicTools
		})
		if err != nil {
			return err
		}

		assistantMsg := message.Choices[0].Message                  // anthropic returns *anthropic.Message directly (no Choices)
		conversation = append(conversation, assistantMsg.ToParam()) // message.ToParam()

		// Process tool calls
		// anthropic: iterate message.Content, check content.Type == "tool_use", use content.ID/content.Name/content.Input
		if len(assistantMsg.ToolCalls) > 0 { // anthropic: len(toolResults) > 0 after iterating message.Content
			for _, tc := range assistantMsg.ToolCalls {
				result := a.executeTool(tc.ID, tc.Function.Name, tc.Function.Arguments) // anthropic: content.ID, content.Name, content.Input
				conversation = append(conversation, result)
			}
			readUserInput = false
			continue
		}

		// Print text response
		// anthropic: iterate message.Content, check content.Type == "text", print content.Text
		if assistantMsg.Content != "" {
			logger.Agent(assistantMsg.Content)
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
