# TypeScript Agent

Requires [Bun](https://bun.sh/).

```bash
bun install   # install dependencies
bun dev       # run
```

## Global CLI install

The agent can be installed as a global command so you can run it from any directory:

```bash
bun link              # registers the `agentts` command globally
cd ~/some-project
agentts               # runs the agent against your current directory
bun unlink agentts    # remove the global command
```

## Files

- `src/index.ts` — Agent loop, streaming with fallback, logger, `<think>` parser.
- `src/tools.ts` — `read_file`, `list_files`, `edit_file` definitions and implementations.
