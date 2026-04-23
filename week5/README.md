# Week 5 — Subagents

Part of the [Agentic SWE Bootcamp (Spring 2026)](../README.md). This week focused on **subagents** — isolated agent workers that investigate, review, or prime context without polluting the main session's conversation.

## What we did

1. **Tested the built-in `@explore` subagent** — OpenCode ships an `Explore` agent that auto-delegates investigation tasks. We ran it against two codebases to see delegation traces in action.

2. **Wrote a custom `@primer` subagent** — a read-only agent that summarizes a project (stack, entry points, conventions, structure, open questions) at the start of a new session. Lives at [`.opencode/agents/primer.md`](.opencode/agents/primer.md). Permissions lock it down: `edit: deny`, `bash: deny`, `webfetch: deny`.

## Repos in this directory

- [`speakslice/`](speakslice/) → symlink to [`../week4/speakslice/`](../week4/speakslice/). Small-but-real Bun/Hono + Python CLI app. Good for showing delegation on a TS → Python boundary.
- [`datasette/`](datasette/) → clone of [`simonw/datasette`](https://github.com/simonw/datasette). Bigger codebase (~tens of thousands of LOC) to show the context-window payoff of subagents on a larger target.

## Why this matters

Subagents are the mechanism by which one agent session stays focused. Investigation, review, and priming all burn tokens and produce noise — delegate them to a fresh-context worker, get back a summary, keep the main thread clean.

- `@explore` → "where is X in this codebase?" without reading 40 files into the main context.
- `@primer` → onboard the main agent to a new repo with a compact structured summary.

## Try it

```bash
# Prime a fresh session on either repo
cd speakslice && opencode   # then: @primer
cd datasette  && opencode   # then: @primer

# Raw searching (observe tokens in main agent)
Find every place we validate or sanitize user input before it reaches the Python subprocess.


# Investigation on speakslice (observe tokens in main agent)
@explore Find every place we validate or sanitize user input before it reaches the Python subprocess.

# Investigation on datasette
@explore Find every place we sanitize SQL or validate query parameters before they're executed against the database.
```
