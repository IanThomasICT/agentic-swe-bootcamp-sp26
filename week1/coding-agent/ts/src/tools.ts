import { readFile, writeFile, readdir } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import * as path from "node:path";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";


interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  function: (input: unknown) => Promise<string>;
}

// const GetWeatherDefinition: ToolDefinition = {
//   name: "get_weather",
//   description: "Get the current weather for a given location.",
//   inputSchema: {
//     type: "object", 
//     properties: {

//   }

// }

const ReadFileDefinition: ToolDefinition = {
  name: "read_file",
  description:
    "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The relative path of a file in the working directory.",
      },
    },
    required: ["path"],
  },
  async function(input: unknown) {
    const { path: filePath } = input as { path: string };
    try {
      const content = await readFile(filePath, "utf-8");
      return content;
    } catch (err) {
      return `Error reading file: ${err}`;
    }
  },
};

const ListFilesDefinition: ToolDefinition = {
  name: "list_files",
  description:
    "List files and directories at a given path. If no path is provided, lists files in the current directory.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Optional relative path to list files from. Defaults to current directory if not provided.",
      },
    },
  },
  async function(input: unknown) {
    const { path: dir } = input as { path?: string };
    const targetDir = dir || ".";
    try {
      const files = await readdir(targetDir, { withFileTypes: true });
      const result = files.map((f) =>
        f.isDirectory() ? f.name + "/" : f.name
      );
      return JSON.stringify(result);
    } catch (err) {
      return `Error listing files: ${err}`;
    }
  },
};

const EditFileDefinition: ToolDefinition = {
  name: "edit_file",
  description: `Make edits to a text file.

Replaces 'old_str' with 'new_str' in the given file. 'old_str' and 'new_str' MUST be different from each other.

If the file specified with path doesn't exist, it will be created.`,
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file",
      },
      old_str: {
        type: "string",
        description:
          "Text to search for - must match exactly and must only have one match exactly",
      },
      new_str: {
        type: "string",
        description: "Text to replace old_str with",
      },
    },
    required: ["path", "old_str", "new_str"],
  },
  async function(input: unknown) {
    const { path: filePath, old_str: oldStr, new_str: newStr } = input as {
      path: string;
      old_str: string;
      new_str: string;
    };

    if (!filePath || oldStr === newStr) {
      return "Error: invalid input parameters";
    }

    try {
      if (!existsSync(filePath)) {
        if (oldStr === "") {
          const dir = path.dirname(filePath);
          if (dir !== ".") {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(filePath, newStr, "utf-8");
          return `Successfully created file ${filePath}`;
        }
        return "Error: file does not exist";
      }

      const content = await readFile(filePath, "utf-8");
      const newContent = content.replace(oldStr, newStr);

      if (content === newContent && oldStr !== "") {
        return "Error: old_str not found in file";
      }

      await writeFile(filePath, newContent, "utf-8");
      return "OK";
    } catch (err) {
      return `Error: ${err}`;
    }
  },
};

export const tools = [ReadFileDefinition, ListFilesDefinition, EditFileDefinition];
