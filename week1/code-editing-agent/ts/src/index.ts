import OpenAI from "openai";
import * as readline from "node:readline";
import { tools } from "./tools";

// Using OpenAI SDK (Most popular SDK) since OpenRouter is OpenAI-compatible. Just need to set the baseURL to OpenRouter's endpoint and provide the API key.
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const model = "qwen/qwen3.6-plus-preview:free";

class Logger {
  private useColor: boolean;

  constructor() {
    this.useColor = !!process.env.SHELL || !!process.env.PSModulePath;
  }

  private format(label: string, color: string): string {
    return this.useColor ? `${color}${label}\x1b[0m` : label;
  }

  agent(msg: string) {
    console.log(`${this.format("Agent", "\x1b[94m")}: ${msg}`);
  }

  user() {
    process.stdout.write(`${this.format("User", "\x1b[97m")}: `);
  }

  tool(msg: string) {
    console.log(`${this.format("Tool", "\x1b[32m")}: ${msg}`);
  }
}

const logger = new Logger();

// Import tools from tools.ts
const chatTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.inputSchema as OpenAI.FunctionParameters,
  },
}));

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

async function executeTool(toolCall: OpenAI.ChatCompletionMessageFunctionToolCall): Promise<string> {
  const { name, arguments: args } = toolCall.function;
  const toolDef = tools.find((t) => t.name === name);

  if (!toolDef) {
    return "tool not found";
  }

  const input = JSON.parse(args);
  logger.tool(`${name}(${JSON.stringify(input)})`);

  try {
    return await toolDef.function(input);
  } catch (err) {
    return `Error: ${err}`;
  }
}

async function runAgent() {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  // Load AGENTS.md as system prompt if it exists
  try {
    const agentsMd = await Bun.file("../AGENTS.md").text();
    if (agentsMd.trim()) {
      messages.push({ role: "system", content: agentsMd });
    }
  } catch {}


  console.log("Chat with Agent (use Ctrl+C to quit)");

  while (true) {
    const userInput = await askUser("User: ");

    if (!userInput) break;

    messages.push({ role: "user", content: userInput });

    let response = await client.chat.completions.create({
      model,
      messages,
      tools: chatTools,
    });

    let assistantMessage = response.choices[0]!.message;

    while (assistantMessage.tool_calls?.length) {
      messages.push(assistantMessage);

      for (const tc of assistantMessage.tool_calls) {
        if (tc.type === "function") {
          const result = await executeTool(tc);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
      }

      response = await client.chat.completions.create({
        model,
        messages,
        tools: chatTools,
      });

      assistantMessage = response.choices[0]!.message;
    }

    const text = assistantMessage.content;
    if (text) {
      logger.agent(text);
      messages.push({ role: "assistant", content: text });
    }
  }
}

runAgent().catch(console.error);
