# Week 1: Code-Editing Agent

Reference implementations of the code-editing agent from [How to Build an Agent](https://ampcode.com/notes/how-to-build-an-agent). The original tutorial uses the Anthropic SDK in Go. This repo has three alternative versions using the OpenAI SDK via OpenRouter:

- **`go/`** - Go
- **`ts/`** - TypeScript (Bun)
- **`cs/`** - C# (.NET 9)

All three implement the same three tools (`read_file`, `list_files`, `edit_file`) and share the same architecture.

## Setup

1. **Get an OpenRouter API key:**
   - Go to https://openrouter.ai/keys
   - Create an account (or sign in with Google/GitHub)
   - Click **Create Key**, copy the key

   We use [OpenRouter](https://openrouter.ai) because it offers free-tier models (like `qwen/qwen3.6-plus:free`), so you can run these demos without spending anything. Note: free-tier models may use your prompts and responses for training. Don't send anything sensitive.

2. **Create a `.env` file in this directory:**
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

3. **Install dependencies for whichever implementation you want to run:**

   **Go** ([install](https://go.dev/dl/)):
   ```bash
   cd go && go mod tidy
   ```

   **TypeScript** ([install Bun](https://bun.sh/)):
   ```bash
   cd ts && bun install
   ```

   **C#** ([install .NET 9](https://dotnet.microsoft.com/download)):
   ```bash
   cd cs && dotnet restore
   ```

## Running

```bash
make go    # or: cd go && go run .
make ts    # or: cd ts && bun dev
make cs    # or: cd cs && dotnet run
```

If you don't have `make` on Windows: `choco install make`, `winget install GnuWin32.Make`, or just use the `cd` commands above.

## Usage

Once running, the agent presents an interactive chat prompt. You can ask it to explore and edit files in the working directory. Examples:

```
User: What files are in this project?
User: Read main.go and summarize what it does
User: Add a comment to the top of main.go explaining the purpose of this file
```

Use `ctrl-c` to quit.

## Features

- **Streaming with fallback**: Attempts streaming first; falls back to a standard request if the model doesn't support it.
- **`<think>` tag parsing**: Qwen models wrap chain-of-thought reasoning in `<think>...</think>` tags. The agents parse these and display thinking in grey italic, separate from the final answer.
- **`AGENTS.md` as system prompt**: All three agents read `AGENTS.md` at startup and prepend it as a system message. Edit this file to customize the agent's behavior.
