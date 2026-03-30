import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { readFile, writeFile, readdir } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import readline from "readline";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  function: (input: unknown) => Promise<string>;
}

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

const tools = [ReadFileDefinition, ListFilesDefinition, EditFileDefinition];

async function executeTool(
  id: string,
  name: string,
  input: unknown
): Promise<{ tool_call_id: string; result: string; is_error?: boolean }> {
  const toolDef = tools.find((t) => t.name === name);
  if (!toolDef) {
    return { tool_call_id: id, result: "tool not found", is_error: true };
  }

  console.log(`\x1b[92mtool\x1b[0m: ${name}(${JSON.stringify(input)})`);

  try {
    const result = await toolDef.function(input);
    return { tool_call_id: id, result };
  } catch (err) {
    return { tool_call_id: id, result: String(err), is_error: true };
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function runAgent() {
  let messages: { role: string; content: string }[] = [];

  console.log("Chat with Claude (use Ctrl+C to quit)");

  while (true) {
    const userInput = await askUser("\x1b[94mYou\x1b[0m: ");

    if (!userInput) break;

    messages.push({ role: "user", content: userInput });

    const result = await generateText({
      model: openrouter("anthropic/claude-3.7-sonnet"),
      messages,
      tools: tools.map((tool) => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      })),
    });

    for (const toolCall of result.toolCalls) {
      const { name, input } = toolCall;
      const toolResult = await executeTool(
        toolCall.id || "",
        name,
        input as unknown
      );
      messages.push({
        role: "tool",
        content: toolResult.result,
        tool_call_id: toolCall.id,
      });
    }

    const text = result.text;
    if (text) {
      console.log(`\x1b[93mClaude\x1b[0m: ${text}`);
    }
  }
}

runAgent().catch(console.error);