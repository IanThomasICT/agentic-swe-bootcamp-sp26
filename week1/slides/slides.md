---
theme: default
title: Building a Code-Editing Agent
info: |
  Week 1 Homework Walkthrough - Agentic SWE Bootcamp Spring 2026
  Based on ampcode.com/notes/how-to-build-an-agent
highlighter: shiki
transition: slide-left
mdc: true
---

# Building a Code-Editing Agent

Week 1 Homework Walkthrough

Based on [How to Build an Agent](https://ampcode.com/notes/how-to-build-an-agent) by Thorsten Ball

<style>
h1 {
  background: linear-gradient(to right, #4EC5D4, #146b8c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>

---

# Article Overview

> "It's an LLM, a loop, and enough tokens."

The original tutorial builds a fully functioning code-editing agent in **~300 lines of Go**.

<v-clicks>

Three ingredients:

1. **An LLM client** -- connect to a model (Anthropic, OpenRouter, etc.)
2. **A conversation loop** -- read input, send to model, print response, repeat
3. **Tools** -- give the model the ability to read, list, and edit files

</v-clicks>

<v-click>

```
User Input --> [Agent Loop] --> LLM API
                  ^                |
                  |          tool_calls?
                  |                |
              results <--- Execute Tools
```

</v-click>

---

# What is a Tool?

The "wink" analogy from the article:

> "Imagine you're telling a friend: **wink if you want me to raise my arm.**"

<v-clicks>

Two things make tool use work:

1. **Tell the model what tools are available** -- send tool definitions with each request
2. **When the model wants a tool, execute it and send results back** -- the model replies with `tool_use`, you run it, return the output

That's the entire secret. The rest is boilerplate.

</v-clicks>

---

# Pseudocode: Building the Agent

````md magic-move
```python
# Step 1: Basic chat loop
def main():
    client = LLMClient(api_key, base_url)
    conversation = []

    while True:
        user_input = get_user_input()
        conversation.append(UserMessage(user_input))

        response = client.chat(conversation)
        conversation.append(response)

        print(response.text)
```

```python
# Step 2: Add tool definitions
def main():
    client = LLMClient(api_key, base_url)
    tools = [read_file, list_files, edit_file]  # <-- define tools
    conversation = []

    while True:
        user_input = get_user_input()
        conversation.append(UserMessage(user_input))

        response = client.chat(conversation, tools=tools)  # <-- pass tools
        conversation.append(response)

        print(response.text)
```

```python
# Step 3: Handle tool calls in a loop
def main():
    client = LLMClient(api_key, base_url)
    tools = [read_file, list_files, edit_file]
    conversation = []

    read_user_input = True
    while True:
        if read_user_input:
            user_input = get_user_input()
            conversation.append(UserMessage(user_input))

        response = client.chat(conversation, tools=tools)
        conversation.append(response)

        if response.has_tool_calls:
            for tool_call in response.tool_calls:
                result = execute_tool(tool_call)        # <-- run the tool
                conversation.append(ToolResult(result))  # <-- feed result back
            read_user_input = False                     # <-- loop without input
            continue

        print(response.text)
        read_user_input = True
```

```python
# Step 4: The three tools
def read_file(path):
    """Read and return file contents"""

def list_files(path="."):
    """Walk directory, return file/dir names"""

def edit_file(path, old_str, new_str):
    """Replace old_str with new_str in file.
    If file doesn't exist and old_str is empty, create it."""

# That's it. ~300 lines. Three tools. One loop.
```
````

---

# Why OpenRouter?

The original article uses the **Anthropic SDK** with `ANTHROPIC_API_KEY`.

We use **OpenRouter** instead:

<v-clicks>

- **Free tier** -- `qwen/qwen3.6-plus-preview:free` costs nothing
- **OpenAI-compatible API** -- use the most popular SDK
- Students can run demos **without paying**

</v-clicks>

<v-click>

Trade-off: free-tier models may train on your inputs. Don't send anything sensitive.

</v-click>

---

# Migration: Anthropic -> OpenAI

<AutoScroll :sections="['', '--- Message types', '--- Tool definitions', '$bottom']">

````md magic-move
```go
// ---- main.go (Anthropic SDK) ----

import "github.com/anthropics/anthropic-sdk-go"

client := anthropic.NewClient()  // auto-reads ANTHROPIC_API_KEY

// --- Message types ---

conversation := []anthropic.MessageParam{}
anthropic.NewUserMessage(anthropic.NewTextBlock(userInput))
conversation = append(conversation, message.ToParam())
message.Content  // iterate for text / tool_use

// --- Tool definitions ---

anthropic.ToolInputSchemaParam
GenerateSchema[ReadFileInput]()  // reflection-based
anthropic.ToolParam{
    Name:        tool.Name,
    Description: anthropic.String(tool.Description),
    InputSchema: tool.InputSchema,
}

// --- Tool results ---

anthropic.NewToolResultBlock(id, response, false)
anthropic.NewToolResultBlock(id, err.Error(), true)
conversation = append(conversation,
    anthropic.NewUserMessage(toolResults...))
```

```go
// ---- main.go (OpenAI SDK via OpenRouter) ----

import openai "github.com/openai/openai-go"       // was anthropic-sdk-go
import "github.com/openai/openai-go/option"        // new: explicit client config

client := openai.NewClient(                        // was anthropic.NewClient()
    option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
    option.WithBaseURL("https://openrouter.ai/api/v1"),
)

// --- Message types ---

conversation := []anthropic.MessageParam{}
anthropic.NewUserMessage(anthropic.NewTextBlock(userInput))
conversation = append(conversation, message.ToParam())
message.Content  // iterate for text / tool_use

// --- Tool definitions ---

anthropic.ToolInputSchemaParam
GenerateSchema[ReadFileInput]()  // reflection-based
anthropic.ToolParam{
    Name:        tool.Name,
    Description: anthropic.String(tool.Description),
    InputSchema: tool.InputSchema,
}

// --- Tool results ---

anthropic.NewToolResultBlock(id, response, false)
anthropic.NewToolResultBlock(id, err.Error(), true)
conversation = append(conversation,
    anthropic.NewUserMessage(toolResults...))
```

```go
// ---- main.go (OpenAI SDK via OpenRouter) ----

import openai "github.com/openai/openai-go"
import "github.com/openai/openai-go/option"

client := openai.NewClient(
    option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
    option.WithBaseURL("https://openrouter.ai/api/v1"),
)

// --- Message types ---

conversation := []openai.ChatCompletionMessageParamUnion{}  // was []anthropic.MessageParam{}
openai.UserMessage(userInput)  // was anthropic.NewUserMessage(anthropic.NewTextBlock(...))
conversation = append(conversation,
    message.Choices[0].Message.ToParam())  // was message.ToParam()
message.Choices[0].Message.Content    // was message.Content
message.Choices[0].Message.ToolCalls  // was inline in Content

// --- Tool definitions ---

anthropic.ToolInputSchemaParam
GenerateSchema[ReadFileInput]()  // reflection-based
anthropic.ToolParam{
    Name:        tool.Name,
    Description: anthropic.String(tool.Description),
    InputSchema: tool.InputSchema,
}

// --- Tool results ---

anthropic.NewToolResultBlock(id, response, false)
anthropic.NewToolResultBlock(id, err.Error(), true)
conversation = append(conversation,
    anthropic.NewUserMessage(toolResults...))
```

```go
// ---- main.go (OpenAI SDK via OpenRouter) ----

import openai "github.com/openai/openai-go"
import "github.com/openai/openai-go/option"

client := openai.NewClient(
    option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
    option.WithBaseURL("https://openrouter.ai/api/v1"),
)

// --- Message types ---

conversation := []openai.ChatCompletionMessageParamUnion{}
openai.UserMessage(userInput)
conversation = append(conversation,
    message.Choices[0].Message.ToParam())
message.Choices[0].Message.Content
message.Choices[0].Message.ToolCalls

// --- Tool definitions ---

shared.FunctionParameters  // was anthropic.ToolInputSchemaParam (now a plain map)
// Manual JSON schema as map literal  (was GenerateSchema[T]() reflection)
shared.FunctionDefinitionParam{  // was anthropic.ToolParam
    Name:        tool.Name,
    Description: openai.String(tool.Description),  // was anthropic.String(...)
    Parameters:  tool.Parameters,  // was InputSchema: tool.InputSchema
}

// --- Tool results ---

anthropic.NewToolResultBlock(id, response, false)
anthropic.NewToolResultBlock(id, err.Error(), true)
conversation = append(conversation,
    anthropic.NewUserMessage(toolResults...))
```

```go
// ---- main.go (OpenAI SDK via OpenRouter) ----

import openai "github.com/openai/openai-go"
import "github.com/openai/openai-go/option"

client := openai.NewClient(
    option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
    option.WithBaseURL("https://openrouter.ai/api/v1"),
)

// --- Message types ---

conversation := []openai.ChatCompletionMessageParamUnion{}
openai.UserMessage(userInput)
conversation = append(conversation,
    message.Choices[0].Message.ToParam())
message.Choices[0].Message.Content
message.Choices[0].Message.ToolCalls

// --- Tool definitions ---

shared.FunctionParameters
// Manual JSON schema as map literal
shared.FunctionDefinitionParam{
    Name:        tool.Name,
    Description: openai.String(tool.Description),
    Parameters:  tool.Parameters,
}

// --- Tool results ---

openai.ToolMessage(response, id)  // was NewToolResultBlock(id, response, false)
openai.ToolMessage(fmt.Sprintf("Error: %s", err), id)  // was NewToolResultBlock(id, err, true)
conversation = append(conversation,
    openai.ToolMessage(response, id))  // was NewUserMessage(toolResults...)
```
````

</AutoScroll>

---
layout: two-cols
---

# Go: Client Setup

```go
package main

import (
    dotenv "github.com/joho/godotenv"
    openai "github.com/openai/openai-go"
    "github.com/openai/openai-go/option"
)

func main() {
    dotenv.Load("../.env")

    client := openai.NewClient(
        option.WithAPIKey(
            os.Getenv("OPENROUTER_API_KEY"),
        ),
        option.WithBaseURL(
            "https://openrouter.ai/api/v1",
        ),
    )

    tools := []ToolDefinition{
        ReadFileDefinition,
        ListFilesDefinition,
        EditFileDefinition,
    }
    agent := NewAgent(&client, getUserMessage, tools)
    agent.Run(context.TODO())
}
```

::right::

# TS: Client Setup

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const model = "qwen/qwen3.6-plus-preview:free";




// Tools are imported from tools.ts
import { tools } from "./tools";

const chatTools: OpenAI.ChatCompletionTool[] =
  tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

runAgent().catch(console.error);
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.6em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: Chat Loop

```go {2-3,7-8,13-14,23}
func (a *Agent) Run(ctx context.Context) error {
    conversation :=
        []openai.ChatCompletionMessageParamUnion{}

    fmt.Println("Chat with Agent (ctrl-c to quit)")

    readUserInput := true
    for {
        if readUserInput {
            logger.User()
            userInput, ok := a.getUserMessage()
            if !ok { break }
            conversation = append(conversation,
                openai.UserMessage(userInput))
        }

        // Call the model
        message, err := a.client.Chat.Completions.New(
            ctx, openai.ChatCompletionNewParams{
                Model:    "qwen/qwen3.6-plus-preview:free",
                Messages: conversation,
                Tools:    chatTools,
            })

        // ... handle tool calls or print response
    }
    return nil
}
```

::right::

# TS: Chat Loop

```ts {2-3,6,11-12,17}
async function runAgent() {
    const messages:
        OpenAI.ChatCompletionMessageParam[] = [];

    console.log("Chat with Agent (Ctrl+C to quit)");

    while (true) {
        const userInput = await askUser("User: ");
        if (!userInput) break;

        messages.push({ role: "user", content: userInput });

        let { content, toolCalls } =
            await callModel(messages);

        // ... handle tool calls or print response

        if (content) {
            printThinkingAndResponse(content);
            messages.push({ role: "assistant", content });
        }
    }
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.6em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: ToolDefinition

```go
type ToolDefinition struct {
    Name        string
    Description string
    Parameters  shared.FunctionParameters
    Function    func(input json.RawMessage) (string, error)
}
```

Schema defined as a **map literal**:

```go
Parameters: shared.FunctionParameters{
    "type": "object",
    "properties": map[string]any{
        "path": map[string]any{
            "type":        "string",
            "description": "The relative path...",
        },
    },
    "required": []string{"path"},
},
```

::right::

# TS: ToolDefinition

```ts
interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    function: (input: unknown) => Promise<string>;
}
```

Schema defined as a **plain object**:

```ts
const schema = {
    type: "object",
    properties: {
        path: {
            type: "string",
            description: "The relative path...",
        },
    },
    required: ["path"],
};
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.65em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: read_file

```go
var ReadFileDefinition = ToolDefinition{
    Name: "read_file",
    Description: "Read the contents of a given " +
        "relative file path. Use this when you " +
        "want to see what's inside a file. " +
        "Do not use this with directory names.",
    Parameters: shared.FunctionParameters{...},
    Function:   ReadFile,
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
```

::right::

# TS: read_file

```ts
const ReadFileDefinition = {
    name: "read_file",
    description:
        "Read the contents of a given " +
        "relative file path. Use this when you " +
        "want to see what's inside a file. " +
        "Do not use this with directory names.",
    inputSchema: {},
    function: async (input: unknown) => {
        const { path: filePath } =
            input as { path: string };
        try {
            const content =
                await readFile(filePath, "utf-8");
            return content;
        } catch (err) {
            return `Error reading file: ${err}`;
        }
    },
};
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.6em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: Agent Loop with Tools

```go {3-5,10-12}
// After getting model response...

if len(toolCalls) > 0 {
    for _, tc := range toolCalls {
        result := a.executeTool(
            tc.ID,
            tc.Function.Name,
            tc.Function.Arguments,
        )
        conversation = append(conversation, result)
    }
    readUserInput = false
    continue  // loop back without reading input
}

// No tool calls -- print text response
if content != "" {
    printThinkingAndResponse(content)
}
readUserInput = true
```

::right::

# TS: Agent Loop with Tools

```ts {3-4,14-16,23}
// After getting model response...

while (toolCalls.length > 0) {
    messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: tc.function,
        })),
    });

    for (const tc of toolCalls) {
        const result = await executeTool(tc);
        messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
        });
    }

    ({ content, toolCalls } = await callModel(messages));
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.55em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: list_files

```go
func ListFiles(input json.RawMessage) (string, error) {
    var li ListFilesInput
    json.Unmarshal(input, &li)

    dir := "."
    if li.Path != "" { dir = li.Path }

    var files []string
    filepath.Walk(dir, func(
        p string, info os.FileInfo, err error,
    ) error {
        relPath, _ := filepath.Rel(dir, p)
        if relPath != "." {
            if info.IsDir() {
                files = append(files, relPath+"/")
            } else {
                files = append(files, relPath)
            }
        }
        return nil
    })

    result, _ := json.Marshal(files)
    return string(result), nil
}
```

::right::

# TS: list_files

```ts
async function listFiles(input: unknown) {
    const { path: dir } =
        input as { path?: string };
    const targetDir = dir || ".";

    try {
        const files = await readdir(
            targetDir,
            { withFileTypes: true },
        );
        const result = files.map((f) =>
            f.isDirectory()
                ? f.name + "/"
                : f.name
        );
        return JSON.stringify(result);
    } catch (err) {
        return `Error listing files: ${err}`;
    }
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.6em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: edit_file

```go
func EditFile(input json.RawMessage) (string, error) {
    var ei EditFileInput
    json.Unmarshal(input, &ei)

    if ei.Path == "" || ei.OldStr == ei.NewStr {
        return "", fmt.Errorf("invalid input")
    }

    content, err := os.ReadFile(ei.Path)
    if err != nil {
        if os.IsNotExist(err) && ei.OldStr == "" {
            return createNewFile(ei.Path, ei.NewStr)
        }
        return "", err
    }

    oldContent := string(content)
    newContent := strings.Replace(
        oldContent, ei.OldStr, ei.NewStr, -1)

    if oldContent == newContent && ei.OldStr != "" {
        return "", fmt.Errorf("old_str not found")
    }

    os.WriteFile(ei.Path, []byte(newContent), 0644)
    return "OK", nil
}
```

::right::

# TS: edit_file

```ts
async function editFile(input: unknown) {
    const { path: filePath, old_str, new_str } =
        input as { path: string;
            old_str: string; new_str: string };

    if (!filePath || old_str === new_str)
        return "Error: invalid input parameters";

    if (!existsSync(filePath)) {
        if (old_str === "") {
            const dir = path.dirname(filePath);
            if (dir !== ".")
                mkdirSync(dir, { recursive: true });
            writeFileSync(filePath, new_str, "utf-8");
            return `Created file ${filePath}`;
        }
        return "Error: file does not exist";
    }

    const content =
        await readFile(filePath, "utf-8");
    const newContent =
        content.replace(old_str, new_str);

    if (content === newContent && old_str !== "")
        return "Error: old_str not found in file";

    await writeFile(filePath, newContent, "utf-8");
    return "OK";
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.55em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: executeTool

```go
func (a *Agent) executeTool(
    id, name, argsJSON string,
) openai.ChatCompletionMessageParamUnion {
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
        return openai.ToolMessage(
            "tool not found", id)
    }

    logger.Tool(fmt.Sprintf(
        "%s(%s)", name, argsJSON))

    response, err := toolDef.Function(
        json.RawMessage(argsJSON))
    if err != nil {
        return openai.ToolMessage(
            fmt.Sprintf("Error: %s", err), id)
    }
    return openai.ToolMessage(response, id)
}
```

::right::

# TS: executeTool

```ts
async function executeTool(
    toolCall: OpenAI
        .ChatCompletionMessageFunctionToolCall,
): Promise<string> {
    const { name, arguments: args } =
        toolCall.function;

    const toolDef = tools.find(
        (t) => t.name === name,
    );

    if (!toolDef) {
        return "tool not found";
    }

    const input = JSON.parse(args);
    logger.tool(
        `${name}(${JSON.stringify(input)})`,
    );

    try {
        return await toolDef.function(input);
    } catch (err) {
        return `Error: ${err}`;
    }
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.6em; line-height: 1.35;
}
</style>

---

# Bonus Features

Extra features beyond the original article:

<v-clicks>

1. **AGENTS.md as system prompt** -- loaded at startup, prepended to conversation
2. **Think tag parsing** -- Qwen wraps reasoning in `<think>...</think>`, displayed separately
3. **Logger class** -- colored output with ANSI escape codes
4. **Streaming with fallback** -- try streaming first, fall back silently
5. **Loading spinner** -- braille animation while waiting for response

</v-clicks>

---
layout: two-cols
---

# Go: AGENTS.md

```go
func (a *Agent) Run(ctx context.Context) error {
    conversation :=
        []openai.ChatCompletionMessageParamUnion{}

    // Load AGENTS.md as system prompt
    if content, err := os.ReadFile("../AGENTS.md");
        err == nil &&
        len(strings.TrimSpace(
            string(content))) > 0 {
        conversation = append(conversation,
            openai.SystemMessage(string(content)))
    }

    // ... rest of agent loop
}
```

::right::

# TS: AGENTS.md

```ts
async function runAgent() {
    const messages:
        OpenAI.ChatCompletionMessageParam[] = [];

    // Load AGENTS.md as system prompt
    try {
        const agentsMd =
            await Bun.file("../AGENTS.md").text();
        if (agentsMd.trim()) {
            messages.push({
                role: "system",
                content: agentsMd,
            });
        }
    } catch {}

    // ... rest of agent loop
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.65em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: Think Tags

```go
func printThinkingAndResponse(content string) {
    thinkStart := strings.Index(
        content, "<think>")
    thinkEnd := strings.Index(
        content, "</think>")

    if thinkStart != -1 && thinkEnd != -1 &&
        thinkEnd > thinkStart {
        thinking := strings.TrimSpace(
            content[thinkStart+7 : thinkEnd])
        answer := strings.TrimSpace(
            content[thinkEnd+8:])
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
```

::right::

# TS: Think Tags

```ts
function printThinkingAndResponse(
    content: string,
) {
    const thinkMatch = content.match(
        /^<think>([\s\S]*?)<\/think>([\s\S]*)$/,
    );

    if (thinkMatch) {
        const thinking = thinkMatch[1].trim();
        const answer = thinkMatch[2].trim();
        if (thinking)
            logger.thinking(thinking);
        if (answer)
            logger.agent(answer);
    } else {
        logger.agent(content);
    }
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.65em; line-height: 1.35;
}
</style>

---
layout: two-cols
---

# Go: Streaming

```go {6-7,9-11,14}
func (a *Agent) runStreaming(ctx context.Context,
    params openai.ChatCompletionNewParams,
    stopSpinner func(),
) (string, []openai.ChatCompletionMessageToolCall,
    error) {
    stream := a.client.Chat.Completions
        .NewStreaming(ctx, params)

    var contentBuilder strings.Builder
    toolCallMap :=
        map[int]*openai.ChatCompletionMessageToolCall{}
    first := true

    for stream.Next() {
        if first {
            stopSpinner()
            first = false
        }
        chunk := stream.Current()
        delta := chunk.Choices[0].Delta

        if delta.Content != "" {
            contentBuilder.WriteString(delta.Content)
        }
        for _, tc := range delta.ToolCalls {
            // accumulate by index...
        }
    }
    return contentBuilder.String(), toolCalls, nil
}
```

::right::

# TS: Streaming

```ts {8-10,12-14,17}
async function callModelStreaming(
    messages: OpenAI.ChatCompletionMessageParam[],
    stopSpinner: () => void,
): Promise<{
    content: string;
    toolCalls: AccumulatedToolCall[];
}> {
    const stream = await client.chat.completions
        .create({ model, messages, tools: chatTools,
            stream: true });

    let content = "";
    const toolCallMap =
        new Map<number, AccumulatedToolCall>();
    let first = true;

    for await (const chunk of stream) {
        if (first) {
            stopSpinner();
            first = false;
        }
        const delta = chunk.choices[0]?.delta;

        if (delta.content)
            content += delta.content;
        if (delta.tool_calls) {
            // accumulate by index...
        }
    }
    return { content, toolCalls };
}
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.5em; line-height: 1.3;
}
</style>

---
layout: two-cols
---

# Go: Spinner

```go
func (l *Logger) StartSpinner() func() {
    stop := make(chan struct{})
    go func() {
        frames := []string{
            "⠋","⠙","⠹","⠸",
            "⠼","⠴","⠦","⠧","⠇","⠏",
        }
        i := 0
        for {
            select {
            case <-stop:
                fmt.Print("\r\x1b[K")
                return
            default:
                fmt.Printf("\r%s",
                    frames[i%len(frames)])
                i++
                time.Sleep(80 * time.Millisecond)
            }
        }
    }()
    return func() { close(stop) }
}
```

Uses a **goroutine + channel** for concurrent animation.

::right::

# TS: Spinner

```ts
function startSpinner(): () => void {
    const frames = [
        "⠋","⠙","⠹","⠸",
        "⠼","⠴","⠦","⠧","⠇","⠏",
    ];
    let i = 0;
    const id = setInterval(() => {
        process.stdout.write(
            `\r${frames[i++ % frames.length]}`,
        );
    }, 80);
    return () => {
        clearInterval(id);
        process.stdout.write("\r\x1b[K");
    };
}
```

Uses **setInterval** -- returns a cleanup function.

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.65em; line-height: 1.35;
}
</style>

---
layout: center
---

# Recap

<v-clicks>

**Core pattern:** LLM + Loop + Tools

**~514 lines** (Go) / **~386 lines** (TS) for a complete code-editing agent

**Migration:** Anthropic SDK to OpenAI SDK is mostly type renaming

**Three tools** do all the work: `read_file`, `list_files`, `edit_file`

> "Go try it -- you'll be surprised how far 300 lines gets you."

</v-clicks>
