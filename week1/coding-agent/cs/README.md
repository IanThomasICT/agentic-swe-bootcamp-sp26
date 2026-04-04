# C# Agent

Requires [.NET 9 SDK](https://dotnet.microsoft.com/download).

```bash
dotnet restore   # install dependencies
dotnet run       # run
```

## Files

- `Program.cs` — Agent loop, streaming with fallback, logger, `<think>` parser.
- `Tools.cs` — `read_file`, `list_files`, `edit_file` definitions and implementations.
