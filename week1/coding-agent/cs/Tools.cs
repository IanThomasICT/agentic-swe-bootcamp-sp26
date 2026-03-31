using System.Text.Json;

namespace CodeEditingAgent;

// ToolDefinition mirrors the TS ToolDefinition interface in tools.ts
record ToolDefinition(
    string Name,
    string Description,
    BinaryData InputSchema,
    Func<JsonElement, Task<string>> Function
);

static class ToolDefinitions
{
    // read_file - mirrors ReadFileDefinition in tools.ts
    static readonly ToolDefinition ReadFile = new(
        "read_file",
        "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
        BinaryData.FromString("""
        {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The relative path of a file in the working directory."
                }
            },
            "required": ["path"]
        }
        """),
        async (input) =>
        {
            var filePath = input.GetProperty("path").GetString()!;
            try
            {
                return await File.ReadAllTextAsync(filePath);
            }
            catch (Exception err)
            {
                return $"Error reading file: {err}";
            }
        }
    );

    // list_files - mirrors ListFilesDefinition in tools.ts
    static readonly ToolDefinition ListFiles = new(
        "list_files",
        "List files and directories at a given path. If no path is provided, lists files in the current directory.",
        BinaryData.FromString("""
        {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Optional relative path to list files from. Defaults to current directory if not provided."
                }
            }
        }
        """),
        async (input) =>
        {
            var dir = input.TryGetProperty("path", out var p) ? p.GetString() ?? "." : ".";
            try
            {
                var entries = Directory.GetFileSystemEntries(dir)
                    .Select(e =>
                    {
                        var name = Path.GetFileName(e);
                        return Directory.Exists(e) ? name + "/" : name;
                    })
                    .ToArray();
                return JsonSerializer.Serialize(entries);
            }
            catch (Exception err)
            {
                return $"Error listing files: {err}";
            }
        }
    );

    // edit_file - mirrors EditFileDefinition in tools.ts
    static readonly ToolDefinition EditFile = new(
        "edit_file",
        """
        Make edits to a text file.

        Replaces 'old_str' with 'new_str' in the given file. 'old_str' and 'new_str' MUST be different from each other.

        If the file specified with path doesn't exist, it will be created.
        """,
        BinaryData.FromString("""
        {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The path to the file"
                },
                "old_str": {
                    "type": "string",
                    "description": "Text to search for - must match exactly and must only have one match exactly"
                },
                "new_str": {
                    "type": "string",
                    "description": "Text to replace old_str with"
                }
            },
            "required": ["path", "old_str", "new_str"]
        }
        """),
        async (input) =>
        {
            var filePath = input.GetProperty("path").GetString()!;
            var oldStr = input.GetProperty("old_str").GetString()!;
            var newStr = input.GetProperty("new_str").GetString()!;

            if (string.IsNullOrEmpty(filePath) || oldStr == newStr)
                return "Error: invalid input parameters";

            try
            {
                if (!File.Exists(filePath))
                {
                    if (oldStr == "")
                    {
                        var dir = Path.GetDirectoryName(filePath);
                        if (!string.IsNullOrEmpty(dir))
                            Directory.CreateDirectory(dir);
                        await File.WriteAllTextAsync(filePath, newStr);
                        return $"Successfully created file {filePath}";
                    }
                    return "Error: file does not exist";
                }

                var content = await File.ReadAllTextAsync(filePath);
                var newContent = content.Replace(oldStr, newStr, StringComparison.Ordinal);

                if (content == newContent && oldStr != "")
                    return "Error: old_str not found in file";

                await File.WriteAllTextAsync(filePath, newContent);
                return "OK";
            }
            catch (Exception err)
            {
                return $"Error: {err}";
            }
        }
    );

    // Export tools list - mirrors `export const tools` in tools.ts
    public static readonly ToolDefinition[] Tools = [ReadFile, ListFiles, EditFile];
}
