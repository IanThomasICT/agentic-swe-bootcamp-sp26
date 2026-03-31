package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"

	dotenv "github.com/joho/godotenv"
	openai "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

var (
	logAgent = NewLogger("Agent", "\x1b[94m") // Blue
	logUser  = NewLogger("User", "\x1b[97m")  // White
	logTool  = NewLogger("Tool", "\x1b[32m")  // Green
)

func main() {
	err := dotenv.Load()
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

	agent := NewAgent(&client, getUserMessage)

	// Go returns errors as values, so we can capture and print it if it exists
	err = agent.Run(context.TODO())
	if err != nil {
		fmt.Printf("Error: %s\n", err.Error())
	}

}

func (a *Agent) Run(ctx context.Context) error {
	conversation := []openai.ChatCompletionMessageParamUnion{ // anthropic.MessageParam -> openai.ChatCompletionMessageParamUnion
	}
	fmt.Println("Chat with Agent (use 'ctrl-c' to quit)")

	// While loop
	for {
		logUser.Print()
		userInput, ok := a.getUserMessage()
		if !ok {
			break
		}

		userMessage := openai.UserMessage(userInput) // anthropic.NewMessage -> openai.UserMessage(userInput)
		conversation = append(conversation, userMessage)

		message, err := a.runInference(ctx, conversation)
		if err != nil {
			return err
		}
		conversation = append(conversation, message.Choices[0].Message.ToParam()) // message.ToParam() -> message.Choices[0].Message.ToParam()

		logAgent.Printf("%s", message.Choices[0].Message.Content)

		// for _, content := range message.Choices[0].Message.Content { // message.Content -> message.Choices[0].Message.Content
		// 	switch content {
		// 	case "text":
		// 		fmt.Printf("\\u001b[93mAgent\\u001b[0m: %s\n", content.Text)
		// 	}
		// }
	}

	return nil
}

func NewAgent(client *openai.Client, getUserMessage func() (string, bool)) *Agent { // *openai.Client
	return &Agent{
		client:         client,
		getUserMessage: getUserMessage,
	}
}

type Agent struct {
	client         *openai.Client // *openai.Client
	getUserMessage func() (string, bool)
}

type Logger struct {
	label string
	color string
	reset string
}

func (l *Logger) Printf(format string, args ...any) {
	fmt.Printf("%s%s%s: %s\n", l.color, l.label, l.reset, fmt.Sprintf(format, args...))
}

func (l *Logger) Print() {
	fmt.Printf("%s%s%s: ", l.color, l.label, l.reset)
}

func NewLogger(label, colorCode string) *Logger {
	if os.Getenv("SHELL") != "" || os.Getenv("PSModulePath") != "" {
		return &Logger{label, colorCode, "\x1b[0m"}
	}
	return &Logger{label, "", ""}
}

func (a *Agent) runInference(ctx context.Context, conversation []openai.ChatCompletionMessageParamUnion) (*openai.ChatCompletion, error) { // []anthropic.MessageParam -> []openai.ChatCompletionMessageParamUnion, anthropic.Message -> *openai.ChatCompletion
	message, err := a.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{ // anthropic.MessageNewParams -> a.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model:     "qwen/qwen3.6-plus-preview:free",
		MaxTokens: openai.Int(1024),
		Messages:  conversation,
	})
	return message, err
}
