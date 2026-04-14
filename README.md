# Agentic SWE Bootcamp (Spring 2026)

Course materials and homework for the Agentic Software Engineering Bootcamp. Each week covers a different topic, with reference implementations, slides, and hands-on exercises.

## Weeks

| Week | Topic | Description | Link |
|------|-------|-------------|------|
| 1 | Code-Editing Agent | Build an AI agent that reads, lists, and edits files. Reference implementations in Go, TypeScript, and C# using the OpenAI SDK via OpenRouter. | [week1/coding-agent](week1/coding-agent/) |
| 2 | In-Class Exercise | A simple FastAPI + SQLAlchemy REST API for CRUD operations on users. Used as an in-class exercise during the session. | [week2/SimpleFastPyAPI](week2/SimpleFastPyAPI/) |
| 5 | TBD | Coming soon. | [week5](week5/) |

## Week 1 Highlights

- **Three reference implementations** of the same agent across [Go](week1/coding-agent/go/), [TypeScript](week1/coding-agent/ts/), and [C#](week1/coding-agent/cs/)
- **Free-tier models** via [OpenRouter](https://openrouter.ai) — no API costs required (`qwen/qwen3.6-plus:free`)
- **Streaming with fallback**, thinking tag parsing, and `AGENTS.md` as system prompt
- Based on the tutorial at [How to Build an Agent](https://ampcode.com/notes/how-to-build-an-agent)

### Quick Start (Week 1)

1. Get an OpenRouter API key at https://openrouter.ai/keys
2. Create `week1/coding-agent/.env`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
3. Install dependencies and run:
   ```bash
   make go    # cd go && go run .
   make ts    # cd ts && bun install && bun dev
   make cs    # cd cs && dotnet restore && dotnet run
   ```

## Week 2 Highlights

- FastAPI + SQLAlchemy REST API with full CRUD on users
- Docker support included
- Run locally with `uvicorn main:app --reload` (after `pip install -r requirements.txt`)

## Prerequisites

- [Go](https://go.dev/dl/) (Week 1 Go implementation)
- [Bun](https://bun.sh/) (Week 1 TypeScript implementation)
- [.NET 9](https://dotnet.microsoft.com/download) (Week 1 C# implementation)
- [Python 3](https://www.python.org/) + pip (Week 2)
- [Docker](https://www.docker.com/) (optional, Week 2)
- An [OpenRouter](https://openrouter.ai) API key (Week 1)