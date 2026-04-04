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

The original tutorial builds a fully functioning code-editing agent in **~300 lines of Go**. We'll reimplement it in **TypeScript** and **C#**.

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

- **Free tier** -- `qwen/qwen3.6-plus:free` costs nothing
- **OpenAI-compatible API** -- use the most popular SDK
- Students can run demos **without paying**

</v-clicks>

<v-click>

Trade-off: free-tier models may train on your inputs. Don't send anything sensitive.

</v-click>

---

# Migration: Anthropic -> OpenAI (Go)

````md magic-move
```go
// main.go — Anthropic SDK (from the article)
package main
import (
    anthropic "github.com/anthropics/anthropic-sdk-go"
    "github.com/invopop/jsonschema"
)

// ... Logger, helpers (unchanged)

func main() {
    client := anthropic.NewClient()
    // ... more
}
    
type Agent struct { client *anthropic.Client /* ... */ }

func (a *Agent) Run(ctx context.Context) error {
    conversation := []anthropic.MessageParam{}
    // ... build []anthropic.ToolUnionParam
    //     via OfTool: &anthropic.ToolParam{Name, Desc, InputSchema}
    // ... loop: anthropic.NewUserMessage(anthropic.NewTextBlock(input))
    
    client.Messages.New(ctx, anthropic.MessageNewParams{
        Model: anthropic.ModelClaude3_7SonnetLatest,
        Messages: conversation, Tools: chatTools,
    })
    // ... more
}
    
type ToolDefinition struct {
    Name, Description string
    InputSchema       anthropic.ToolInputSchemaParam
    Function          func(json.RawMessage) (string, error)
}
// ... tool schemas via jsonschema.GenerateSchema[T]()
// ... ReadFile, ListFiles, EditFile functions (unchanged)

// ... executeTool → anthropic.NewToolResultBlock(id, resp, false)
```

```go
// main.go — Anthropic SDK (from the article)
package main
import (
    openai "github.com/openai/openai-go"           // was anthropic
    "github.com/openai/openai-go/option"           // new
    "github.com/openai/openai-go/shared"           // new
)

// ... Logger, helpers (unchanged)

func main() {
    client := anthropic.NewClient()
    // ... more
}
    
type Agent struct { client *anthropic.Client /* ... */ }

func (a *Agent) Run(ctx context.Context) error {
    conversation := []anthropic.MessageParam{}
    // ... build []anthropic.ToolUnionParam
    //     via OfTool: &anthropic.ToolParam{Name, Desc, InputSchema}
    // ... loop: anthropic.NewUserMessage(anthropic.NewTextBlock(input))

    client.Messages.New(ctx, anthropic.MessageNewParams{
        Model: anthropic.ModelClaude3_7SonnetLatest,
        Messages: conversation, Tools: chatTools,
    })
    // ... more
}
    
type ToolDefinition struct {
    Name, Description string
    InputSchema       anthropic.ToolInputSchemaParam
    Function          func(json.RawMessage) (string, error)
}
// ... tool schemas via jsonschema.GenerateSchema[T]()
// ... ReadFile, ListFiles, EditFile functions (unchanged)

// ... executeTool → anthropic.NewToolResultBlock(id, resp, false)
```
            
```go
// main.go — OpenAI SDK via OpenRouter
package main
import (
    openai "github.com/openai/openai-go"           
    "github.com/openai/openai-go/option"           
    "github.com/openai/openai-go/shared"           
)

// ... Logger, helpers (unchanged)

func main() {
    client := openai.NewClient(                    // was anthropic.NewClient()
        option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
        option.WithBaseURL("https://openrouter.ai/api/v1"),
    )
    // ... more
}
    
type Agent struct { client *openai.Client /* ... */ }  // was *anthropic.Client
func (a *Agent) Run(ctx context.Context) error {
    conversation := []anthropic.MessageParam{}
    // ... build []anthropic.ToolUnionParam
    //     via OfTool: &anthropic.ToolParam{Name, Desc, InputSchema}
    // ... loop: anthropic.NewUserMessage(anthropic.NewTextBlock(input))

    client.Messages.New(ctx, anthropic.MessageNewParams{
        Model: anthropic.ModelClaude3_7SonnetLatest,
        Messages: conversation, Tools: chatTools,
    })
    // ... more
}
    
type ToolDefinition struct {
    Name, Description string
    InputSchema       anthropic.ToolInputSchemaParam
    Function          func(json.RawMessage) (string, error)
}
// ... tool schemas via jsonschema.GenerateSchema[T]()
// ... ReadFile, ListFiles, EditFile functions (unchanged)

// ... executeTool → anthropic.NewToolResultBlock(id, resp, false)
```

```go
// main.go — OpenAI SDK via OpenRouter
package main
import (
    openai "github.com/openai/openai-go"
    "github.com/openai/openai-go/option"
    "github.com/openai/openai-go/shared"
)

// ... Logger, helpers (unchanged)

func main() {
    client := openai.NewClient(
        option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
        option.WithBaseURL("https://openrouter.ai/api/v1"),
    )
    // ... more
}
        
type Agent struct { client *openai.Client /* ... */ }
func (a *Agent) Run(ctx context.Context) error {
    conversation := []openai.ChatCompletionMessageParamUnion{}   // was anthropic.MessageParam
    // ... build []openai.ChatCompletionToolParam                // was ToolUnionParam
    //     via Function: shared.FunctionDefinitionParam{...}     // was OfTool
    // ... loop: openai.UserMessage(input)                       // was NewUserMessage

    client.Messages.New(ctx, anthropic.MessageNewParams{
        Model: anthropic.ModelClaude3_7SonnetLatest,
        Messages: conversation, Tools: chatTools,
    })
    // ... more
}
                
    
type ToolDefinition struct {
    Name, Description string
    InputSchema       anthropic.ToolInputSchemaParam
    Function          func(json.RawMessage) (string, error)
}
// ... tool schemas via jsonschema.GenerateSchema[T]()
// ... ReadFile, ListFiles, EditFile functions (unchanged)

// ... executeTool → anthropic.NewToolResultBlock(id, resp, false)
```

```go
// main.go — OpenAI SDK via OpenRouter
package main
import (
    openai "github.com/openai/openai-go"
    "github.com/openai/openai-go/option"
    "github.com/openai/openai-go/shared"
)

// ... Logger, helpers (unchanged)

func main() {
    client := openai.NewClient(
        option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
        option.WithBaseURL("https://openrouter.ai/api/v1"),
    )
    // ... more
    }
    
type Agent struct { client *openai.Client /* ... */ }
func (a *Agent) Run(ctx context.Context) error {
    conversation := []openai.ChatCompletionMessageParamUnion{}
    // ... build []openai.ChatCompletionToolParam
    //     via Function: shared.FunctionDefinitionParam{...}
    // ... loop: openai.UserMessage(input)
    
    client.Chat.Completions.New(ctx,                       // was Messages.New
        openai.ChatCompletionNewParams{                    // was anthropic.MessageNewParams
            Model: "qwen/qwen3.6-plus:free",               // was ModelClaude3_7SonnetLatest
            Messages: conversation, Tools: chatTools,
        }
    )
    // ... more
}

type ToolDefinition struct {
    Name, Description string
    InputSchema       anthropic.ToolInputSchemaParam
    Function          func(json.RawMessage) (string, error)
}
// ... tool schemas via jsonschema.GenerateSchema[T]()
// ... ReadFile, ListFiles, EditFile functions (unchanged)

// ... executeTool → anthropic.NewToolResultBlock(id, resp, false)
```

```go
// main.go — OpenAI SDK via OpenRouter
package main
import (
    openai "github.com/openai/openai-go"
    "github.com/openai/openai-go/option"
    "github.com/openai/openai-go/shared"
)

// ... Logger, helpers (unchanged)

func main() {
    client := openai.NewClient(
        option.WithAPIKey(os.Getenv("OPENROUTER_API_KEY")),
        option.WithBaseURL("https://openrouter.ai/api/v1"),
    )
    // ... more
    }
    
type Agent struct { client *openai.Client /* ... */ }
func (a *Agent) Run(ctx context.Context) error {
    conversation := []openai.ChatCompletionMessageParamUnion{}
    // ... build []openai.ChatCompletionToolParam
    //     via Function: shared.FunctionDefinitionParam{...}
    // ... loop: openai.UserMessage(input)
    
    client.Chat.Completions.New(ctx,                       // was Messages.New
        openai.ChatCompletionNewParams{                    // was anthropic.MessageNewParams
            Model: "qwen/qwen3.6-plus:free",               // was ModelClaude3_7SonnetLatest
            Messages: conversation, Tools: chatTools,
        }
    )
    // ... more
}

type ToolDefinition struct {
    Name, Description string
    Parameters        shared.FunctionParameters             // InputSchema anthropic.ToolInputSchemaParam -> Parameters 
    Function          func(json.RawMessage) (string, error)
}
// ... tool schemas via shared.FunctionParameters{...}
// ... ReadFile, ListFiles, EditFile functions (unchanged)

// ... executeTool → openai.ToolMessage(resp, id)           // was NewToolResultBlock
```
````

<style>
:deep(pre) { font-size: 0.45em !important; line-height: 1.3 !important; }
</style>

---
layout: two-cols
---

# C#: Client Setup

```csharp
using System.ClientModel;
using OpenAI.Chat;

DotNetEnv.Env.Load("../.env");
var model = "qwen/qwen3.6-plus:free";
var apiKey = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY") ?? "";
var client = new ChatClient(model, new ApiKeyCredential(apiKey),
    new OpenAI.OpenAIClientOptions {
        Endpoint = new Uri("https://openrouter.ai/api/v1")
    });

var chatTools = ToolDefinitions.Tools
    .Select(t => ChatTool.CreateFunctionTool(t.Name, t.Description, t.InputSchema))
    .ToList();
```

::right::

# TS: Client Setup

```ts
import OpenAI from "openai";
import { tools } from "./tools";

const model = "qwen/qwen3.6-plus:free";
const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
});

const chatTools: OpenAI.ChatCompletionTool[] =
    tools.map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description,
                    parameters: t.inputSchema },
    }));
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: Chat Loop

```csharp
var messages = new List<ChatMessage>();

while (true)
{
    var userInput = Console.ReadLine();
    if (string.IsNullOrEmpty(userInput)) break;

    messages.Add(ChatMessage.CreateUserMessage(userInput));
    var (content, toolCalls) = await CallModel(messages);

    // ... handle tool calls (next slide)

    PrintThinkingAndResponse(content);
    messages.Add(ChatMessage.CreateAssistantMessage(content));
}
```

::right::

# TS: Chat Loop

```ts
async function runAgent() {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    while (true) {
        const userInput = await askUser("User: ");
        if (!userInput) break;

        messages.push({ role: "user", content: userInput });
        let { content, toolCalls } = await callModel(messages);

        // ... handle tool calls (next slide)

        printThinkingAndResponse(content);
        messages.push({ role: "assistant", content });
    }
}
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: ToolDefinition

```csharp
record ToolDefinition(
    string Name,
    string Description,
    BinaryData InputSchema,
    Func<JsonElement, Task<string>> Function
);
```

Schema defined as a **raw JSON string**:

```csharp
var schema = BinaryData.FromString("""
{
    "type": "object",
    "properties": {
        "path": {
            "type": "string",
            "description": "The relative path..."
        }
    },
    "required": ["path"]
}
""");
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
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: read_file

```csharp
static readonly ToolDefinition ReadFile = new(
    "read_file",
    "Read the contents of a given relative file path.",
    BinaryData.FromString("""{ ... }"""),
    async (input) => {
        var filePath = input.GetProperty("path").GetString()!;
        try {
            return await File.ReadAllTextAsync(filePath);
        } catch (Exception err) {
            return $"Error reading file: {err}";
        }
    }
);
```

::right::

# TS: read_file

```ts
const ReadFileDefinition = {
    name: "read_file",
    description: "Read the contents of a given relative file path.",
    inputSchema: {},
    function: async (input: unknown) => {
        const { path: filePath } = input as { path: string };
        try {
            return await readFile(filePath, "utf-8");
        } catch (err) {
            return `Error reading file: ${err}`;
        }
    },
};
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: Agent Loop with Tools

```csharp
// After getting model response...

while (toolCalls.Count > 0)
{
    messages.Add(
        new AssistantChatMessage(toolCalls));

    foreach (var tc in toolCalls)
    {
        var result = await ExecuteTool(tc);
        messages.Add(ChatMessage
            .CreateToolMessage(tc.Id, result));
    }

    (content, toolCalls) =
        await CallModel(messages);
}
```

::right::

# TS: Agent Loop with Tools

```ts
// After getting model response...

while (toolCalls.length > 0) {
    messages.push({
        role: "assistant",
        tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: tc.function,
        })),
    });

    for (const tc of toolCalls) {
        const result = await executeTool(tc);
        messages.push({ role: "tool",
            tool_call_id: tc.id,
            content: result });
    }

    ({ content, toolCalls } =
        await callModel(messages));
}
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: list_files

```csharp
async (input) => {
    var dir = input.TryGetProperty("path", out var p) ? p.GetString() ?? "." : ".";
    try {
        var entries = Directory.GetFileSystemEntries(dir)
            .Select(e => {
                var name = Path.GetFileName(e);
                return Directory.Exists(e) ? name + "/" : name;
            }).ToArray();
        return JsonSerializer.Serialize(entries);
    } catch (Exception err) {
        return $"Error listing files: {err}";
    }
}
```

::right::

# TS: list_files

```ts
async function listFiles(input: unknown) {
    const { path: dir } = input as { path?: string };
    try {
        const files = await readdir(dir || ".", { withFileTypes: true });
        return JSON.stringify(files.map(f => f.isDirectory() ? f.name + "/" : f.name));
    } catch (err) {
        return `Error listing files: ${err}`;
    }
}
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: edit_file

```csharp
async (input) => {
    var filePath = input.GetProperty("path").GetString()!;
    var oldStr   = input.GetProperty("old_str").GetString()!;
    var newStr   = input.GetProperty("new_str").GetString()!;
    if (string.IsNullOrEmpty(filePath) || oldStr == newStr)
        return "Error: invalid input parameters";

    if (!File.Exists(filePath)) {
        if (oldStr == "") {
            var dir = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            await File.WriteAllTextAsync(filePath, newStr);
            return $"Created file {filePath}";
        }
        return "Error: file does not exist";
    }
    var content = await File.ReadAllTextAsync(filePath);
    var newContent = content.Replace(oldStr, newStr);
    if (content == newContent && oldStr != "") return "Error: old_str not found";
    await File.WriteAllTextAsync(filePath, newContent);
    return "OK";
}
```

::right::

# TS: edit_file

```ts
async function editFile(input: unknown) {
    const { path: filePath, old_str, new_str } =
        input as { path: string; old_str: string; new_str: string };
    if (!filePath || old_str === new_str)
        return "Error: invalid input parameters";

    if (!existsSync(filePath)) {
        if (old_str === "") {
            const dir = path.dirname(filePath);
            if (dir !== ".") mkdirSync(dir, { recursive: true });
            writeFileSync(filePath, new_str, "utf-8");
            return `Created file ${filePath}`;
        }
        return "Error: file does not exist";
    }
    const content = await readFile(filePath, "utf-8");
    const newContent = content.replace(old_str, new_str);
    if (content === newContent && old_str !== "") return "Error: old_str not found";
    await writeFile(filePath, newContent, "utf-8");
    return "OK";
}
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: ExecuteTool

```csharp
async Task<string> ExecuteTool(ChatToolCall toolCall) {
    var toolDef = ToolDefinitions.Tools
        .FirstOrDefault(t => t.Name == toolCall.FunctionName);
    if (toolDef is null) return "tool not found";

    var input = JsonDocument.Parse(toolCall.FunctionArguments).RootElement;
    logger.Tool($"{toolCall.FunctionName}({toolCall.FunctionArguments})");
    try {
        return await toolDef.Function(input);
    } catch (Exception err) {
        return $"Error: {err}";
    }
}
```

::right::

# TS: executeTool

```ts
async function executeTool(
    toolCall: OpenAI.ChatCompletionMessageFunctionToolCall,
): Promise<string> {
    const { name, arguments: args } = toolCall.function;
    const toolDef = tools.find(t => t.name === name);
    if (!toolDef) return "tool not found";

    const input = JSON.parse(args);
    logger.tool(`${name}(${JSON.stringify(input)})`);
    try {
        return await toolDef.function(input);
    } catch (err) { return `Error: ${err}`; }
}
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---

# Bonus Features

Extra features beyond the original article:

<v-clicks>

1. **AGENTS.md as system prompt** -- loaded at startup, prepended to conversation
2. **Loading spinner** -- braille animation while waiting for response
3. **Logger class** -- colored ANSI output for each message type
4. **And more** -- streaming, think tag parsing...

</v-clicks>

---
layout: two-cols
---

# C#: AGENTS.md

```csharp
var messages = new List<ChatMessage>();

// Load AGENTS.md as system prompt
try {
    var agentsMd = await File.ReadAllTextAsync("../AGENTS.md");
    if (!string.IsNullOrWhiteSpace(agentsMd))
        messages.Add(ChatMessage.CreateSystemMessage(agentsMd));
} catch { }

// ... rest of agent loop
```

::right::

# TS: AGENTS.md

```ts
const messages: OpenAI.ChatCompletionMessageParam[] = [];

// Load AGENTS.md as system prompt
try {
    const agentsMd = await Bun.file("../AGENTS.md").text();
    if (agentsMd.trim())
        messages.push({ role: "system", content: agentsMd });
} catch {}

// ... rest of agent loop
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.5em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: Spinner

```csharp
public Action StartSpinner() {
    var frames = new[] { "⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏" };
    var i = 0;
    var cts = new CancellationTokenSource();
    _ = Task.Run(async () => {
        while (!cts.Token.IsCancellationRequested) {
            Console.Write($"\r{frames[i++ % frames.Length]}");
            try { await Task.Delay(80, cts.Token); } catch { break; }
        }
    });
    return () => { cts.Cancel(); Console.Write("\r\x1b[K"); };
}
```

Uses **Task.Run + CancellationToken** for concurrent animation.

::right::

# TS: Spinner

```ts
function startSpinner(): () => void {
    const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
    let i = 0;
    const id = setInterval(() => {
        process.stdout.write(`\r${frames[i++ % frames.length]}`);
    }, 80);
    return () => {
        clearInterval(id);
        process.stdout.write("\r\x1b[K");
    };
}
```

Uses **setInterval** -- returns a cleanup function.

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---
layout: two-cols
---

# C#: Logger

```csharp
class Logger {
    void Print(string color, string label, string msg = "") =>
        Console.WriteLine($"\n{color}{label}\x1b[0m{msg}");

    public void User()               => Console.Write("\n\x1b[32mUser: \x1b[0m");
    public void Agent(string msg)    => Print("\x1b[34m", "Agent: ",    msg);
    public void Tool(string msg)     => Print("\x1b[33m", "[tool] ",    msg);
    public void Thinking(string msg) => Print("\x1b[90m", "[thinking] ", msg);
}
```

::right::

# TS: Logger

```ts
const logger = {
    user:     () =>
        process.stdout.write("\n\x1b[32mUser: \x1b[0m"),
    agent:    (msg: string) =>
        console.log("\n\x1b[34mAgent:\x1b[0m",    msg),
    tool:     (msg: string) =>
        console.log("\n\x1b[33m[tool]\x1b[0m",    msg),
    thinking: (msg: string) =>
        console.log("\n\x1b[90m[thinking]\x1b[0m", msg),
};
```

<style>
h1 { font-size: 1.2em; }
:deep(.col-left pre), :deep(.col-right pre) {
  font-size: 0.45em !important; line-height: 1.3 !important;
  margin: 0 5px 0 0;
}
</style>

---

# And More...

<v-clicks>

- **Streaming** -- real-time output via `CompleteChatStreamingAsync` (C#) / `{ stream: true }` (TS)
- **Think tag parsing** -- Qwen wraps reasoning in `<think>...</think>`, displayed separately from the answer
- **Model picker**
- etc.

</v-clicks>

---
layout: center
---

# Recap

<v-clicks>

**Core pattern:** LLM + Loop + Tools

**~390 lines** (C#) / **~386 lines** (TS) for a complete code-editing agent

**Migration:** Anthropic SDK to OpenAI SDK is mostly type renaming

**Three tools** do all the work: `read_file`, `list_files`, `edit_file`

> "Go try it -- you'll be surprised how far 300 lines gets you."

</v-clicks>
