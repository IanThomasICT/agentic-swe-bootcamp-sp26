# Code-Editing Agent

## What this is

Week 1 homework for the Agentic SWE Bootcamp (Spring 2026). Students followed the tutorial at https://ampcode.com/notes/how-to-build-an-agent which builds a code-editing agent using the Anthropic SDK in Go.

This repo provides two alternative reference implementations (Go and TypeScript) that use the OpenAI SDK via OpenRouter instead of the Anthropic SDK directly. The goal is to show students how the same agent looks across different languages and SDKs.

## Key decisions

- **OpenRouter instead of Anthropic API**: OpenRouter has a free tier (`qwen/qwen3.6-plus-preview:free`) so students can run demos without paying. Free-tier models may train on inputs.
- **OpenAI SDK, not Anthropic SDK**: The OpenAI SDK is the most widely used and OpenRouter is OpenAI-compatible. Inline comments in `go/main.go` map each `openai.*` call to the equivalent `anthropic.*` call from the original tutorial.
- **`go/main.go` inline comments**: These `// anthropic.*` comments are intentional teaching aids. Do not remove them.
- **Streaming with fallback**: Both agents try streaming first. If the model doesn't support it, they fall back to a standard request silently.
- **`<think>` tag parsing**: Qwen models wrap chain-of-thought reasoning in `<think>...</think>` tags. The agents parse these and display thinking in grey italic, separate from the final answer.
- **Shared `.env`**: Both implementations read `../.env` from their subdirectory so there's one API key config at the project root.
- **This file is loaded as the system prompt**: Both agents read `AGENTS.md` at startup and prepend it as a system message if it has content.

## Slideshow

There's a planned slidev presentation (`slides-flow.md`) to walk students through the homework. The sequence:

1. Overview of the original article
2. Pseudocode showing each step (start, list tool, read tool, edit tool) with transitions
3. Anthropic-to-OpenAI migration: show diffs between the article's Go snippets and our OpenRouter-based Go snippets
4. Side-by-side TypeScript and Go walkthrough with transitions for each step
5. Bonus features: AGENTS.md as system prompt, think tag output, streaming, local session storage/resume

The slides should highlight what changed and why at each step, not just show final code.

## Response Guidelines

- Never use emojis
- Answer concisely and efficiently with only essential information.
