# Week 1: Code-Editing Agent

Reference implementations of the code-editing agent from [How to Build an Agent](https://ampcode.com/notes/how-to-build-an-agent). The original tutorial uses the Anthropic SDK in Go. This repo has two alternative versions:

- **`go/`** - Go, using the OpenAI SDK via OpenRouter
- **`ts/`** - TypeScript (Bun), using the OpenAI SDK via OpenRouter
- **`cs/`** - C# (.NET 9), using the openai-dotnet SDK via OpenRouter

Both implement the same three tools: `read_file`, `list_files`, `edit_file`.

## Setup

1. Get an OpenRouter API key:
   - Go to https://openrouter.ai/keys
   - Create an account (or sign in with Google/GitHub)
   - Click **Create Key**, copy the key
   
   We use [OpenRouter](https://openrouter.ai) because it offers free-tier models (like `qwen/qwen3.6-plus-preview:free`), so you can run these demos without spending anything. Note: free models may use your prompts and responses for training. Don't send anything sensitive.

2. Create a `.env` file in this directory:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

3. Install dependencies:

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
make go    # or: cd go && go run main.go
make ts    # or: cd ts && bun dev
make cs    # or: cd cs && dotnet run
```

If you don't have `make` on Windows: `choco install make`, `winget install GnuWin32.Make`, or just use the `cd` commands above.
