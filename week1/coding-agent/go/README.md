# Go Agent

Requires [Go 1.21+](https://go.dev/dl/).

```bash
go mod tidy   # install dependencies
go run .      # run (not `go run main.go` — the package has multiple files)
```

## Files

- `main.go` — Agent loop, logger, `<think>` parser. Has inline `// anthropic.*` comments mapping each OpenAI SDK call to the original tutorial's Anthropic equivalent.
- `tools.go` — `read_file`, `list_files`, `edit_file` definitions and implementations.
