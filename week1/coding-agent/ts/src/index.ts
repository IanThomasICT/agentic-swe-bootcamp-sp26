#!/usr/bin/env bun
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

  thinking(msg: string) {
    if (this.useColor) {
      console.log(`\x1b[3;90m${msg}\x1b[0m`);
    } else {
      console.log(`(thinking) ${msg}`);
    }
  }

  startSpinner(): () => void {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const id = setInterval(() => {
      process.stdout.write(`\r${frames[i++ % frames.length]}`);
    }, 80);
    return () => {
      clearInterval(id);
      process.stdout.write("\r\x1b[K");
    };
  }
}

const logger = new Logger();

function printThinkingAndResponse(content: string) {
  // Qwen wraps reasoning in <think>...</think> tags
  const thinkMatch = content.match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/);
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim();
    const answer = thinkMatch[2].trim();
    if (thinking) logger.thinking(thinking);
    if (answer) logger.agent(answer);
  } else {
    logger.agent(content);
  }
}

interface AccumulatedToolCall {
  id: string;
  function: { name: string; arguments: string };
}

async function callModelStreaming(
  messages: OpenAI.ChatCompletionMessageParam[],
  stopSpinner: () => void,
): Promise<{ content: string; toolCalls: AccumulatedToolCall[] }> {
  const stream = await client.chat.completions.create({
    model,
    messages,
    tools: chatTools,
    stream: true,
  });

  let content = "";
  const toolCallMap = new Map<number, AccumulatedToolCall>();
  let first = true;

  for await (const chunk of stream) {
    if (first) {
      stopSpinner();
      first = false;
    }

    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) content += delta.content;

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        let existing = toolCallMap.get(tc.index);
        if (!existing) {
          existing = { id: "", function: { name: "", arguments: "" } };
          toolCallMap.set(tc.index, existing);
        }
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.function.name = tc.function.name;
        if (tc.function?.arguments)
          existing.function.arguments += tc.function.arguments;
      }
    }
  }

  if (first) stopSpinner();

  const toolCalls: AccumulatedToolCall[] = [];
  for (let i = 0; i < toolCallMap.size; i++) {
    const tc = toolCallMap.get(i);
    if (tc) toolCalls.push(tc);
  }

  return { content, toolCalls };
}

async function callModel(
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<{ content: string; toolCalls: AccumulatedToolCall[] }> {
  const stopSpinner = logger.startSpinner();

  try {
    return await callModelStreaming(messages, stopSpinner);
  } catch {
    // Fallback to non-streaming
    stopSpinner();
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: chatTools,
    });
    const msg = response.choices[0]!.message;
    const toolCalls = (msg.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
    return { content: msg.content ?? "", toolCalls };
  }
}

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

    let { content, toolCalls } = await callModel(messages);

    while (toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: tc.function,
        })),
      });

      for (const tc of toolCalls) {
        const result = await executeTool(tc as OpenAI.ChatCompletionMessageFunctionToolCall);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      ({ content, toolCalls } = await callModel(messages));
    }

    if (content) {
      printThinkingAndResponse(content);
      messages.push({ role: "assistant", content });
    }
  }
}

runAgent().catch(console.error);
