using System.ClientModel;
using System.Text.Json;
using System.Text.RegularExpressions;
using CodeEditingAgent;
using OpenAI.Chat;

// Load ../.env (shared .env at project root) - mirrors TS `bun run --env-file=../.env`
DotNetEnv.Env.Load("../.env");

// Using OpenAI SDK since OpenRouter is OpenAI-compatible. Just set the endpoint to OpenRouter.
// mirrors TS: new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" })
var model = "qwen/qwen3.6-plus-preview:free";
var apiKey = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY") ?? "";
var client = new ChatClient(
    model,
    new ApiKeyCredential(apiKey),
    new OpenAI.OpenAIClientOptions { Endpoint = new Uri("https://openrouter.ai/api/v1") }
);

// Build chat tools from ToolDefinitions - mirrors TS `chatTools` array
var chatTools = ToolDefinitions.Tools.Select(t =>
    ChatTool.CreateFunctionTool(t.Name, t.Description, t.InputSchema)
).ToList();

var logger = new Logger();

// --- Agent loop - mirrors TS runAgent() ---

var messages = new List<ChatMessage>();

// Load AGENTS.md as system prompt if it exists - mirrors TS try/catch block
try
{
    var agentsMd = await File.ReadAllTextAsync("../AGENTS.md");
    if (!string.IsNullOrWhiteSpace(agentsMd))
        messages.Add(ChatMessage.CreateSystemMessage(agentsMd));
}
catch { }

Console.WriteLine("Chat with Agent (use Ctrl+C to quit)");

while (true)
{
    logger.User();
    var userInput = Console.ReadLine();
    if (string.IsNullOrEmpty(userInput)) break;

    messages.Add(ChatMessage.CreateUserMessage(userInput));

    var (content, toolCalls) = await CallModel(messages);

    // Agentic loop: keep calling model while it wants to use tools
    while (toolCalls.Count > 0)
    {
        // Append assistant message with tool calls
        var assistantMessage = new AssistantChatMessage(toolCalls);
        if (!string.IsNullOrEmpty(content))
            assistantMessage.Content.Add(ChatMessageContentPart.CreateTextPart(content));
        messages.Add(assistantMessage);

        // Execute each tool and append results
        foreach (var tc in toolCalls)
        {
            var result = await ExecuteTool(tc);
            messages.Add(ChatMessage.CreateToolMessage(tc.Id, result));
        }

        (content, toolCalls) = await CallModel(messages);
    }

    if (!string.IsNullOrEmpty(content))
    {
        PrintThinkingAndResponse(content);
        messages.Add(ChatMessage.CreateAssistantMessage(content));
    }
}

// --- CallModel: streaming with fallback - mirrors TS callModel() ---

async Task<(string content, List<ChatToolCall> toolCalls)> CallModel(List<ChatMessage> msgs)
{
    var options = new ChatCompletionOptions();
    foreach (var tool in chatTools)
        options.Tools.Add(tool);

    var stopSpinner = logger.StartSpinner();

    try
    {
        return await CallModelStreaming(msgs, options, stopSpinner);
    }
    catch
    {
        // Fallback to non-streaming - mirrors TS catch block
        stopSpinner();
        var response = await client.CompleteChatAsync(msgs, options);
        var msg = response.Value;
        return (msg.Content.FirstOrDefault()?.Text ?? "", msg.ToolCalls.ToList());
    }
}

// --- Streaming implementation - mirrors TS callModelStreaming() ---

async Task<(string content, List<ChatToolCall> toolCalls)> CallModelStreaming(
    List<ChatMessage> msgs,
    ChatCompletionOptions options,
    Action stopSpinner)
{
    var stream = client.CompleteChatStreamingAsync(msgs, options);

    var content = "";
    var toolCallMap = new Dictionary<int, (string id, string name, string args)>();
    var first = true;

    await foreach (var update in stream)
    {
        if (first) { stopSpinner(); first = false; }

        // Accumulate content deltas
        foreach (var part in update.ContentUpdate)
            content += part.Text;

        // Accumulate tool call deltas - mirrors TS toolCallMap logic
        foreach (var tc in update.ToolCallUpdates)
        {
            if (!toolCallMap.TryGetValue(tc.Index, out var existing))
                existing = ("", "", "");
            if (tc.ToolCallId is not null) existing.id = tc.ToolCallId;
            if (tc.FunctionName is not null) existing.name = tc.FunctionName;
            if (tc.FunctionArgumentsUpdate is not null) existing.args += tc.FunctionArgumentsUpdate.ToString();
            toolCallMap[tc.Index] = existing;
        }
    }

    if (first) stopSpinner();

    // Convert accumulated tool calls to ChatToolCall objects
    var toolCalls = toolCallMap
        .OrderBy(kv => kv.Key)
        .Select(kv => ChatToolCall.CreateFunctionToolCall(kv.Value.id, kv.Value.name, BinaryData.FromString(kv.Value.args)))
        .ToList();

    return (content, toolCalls);
}

// --- ExecuteTool - mirrors TS executeTool() ---

async Task<string> ExecuteTool(ChatToolCall toolCall)
{
    var toolDef = ToolDefinitions.Tools.FirstOrDefault(t => t.Name == toolCall.FunctionName);
    if (toolDef is null)
        return "tool not found";

    var input = JsonDocument.Parse(toolCall.FunctionArguments).RootElement;
    logger.Tool($"{toolCall.FunctionName}({toolCall.FunctionArguments})");

    try
    {
        return await toolDef.Function(input);
    }
    catch (Exception err)
    {
        return $"Error: {err}";
    }
}

// --- PrintThinkingAndResponse - mirrors TS printThinkingAndResponse() ---

void PrintThinkingAndResponse(string text)
{
    // Qwen wraps reasoning in <think>...</think> tags
    var match = Regex.Match(text, @"^<think>([\s\S]*?)</think>([\s\S]*)$");
    if (match.Success)
    {
        var thinking = match.Groups[1].Value.Trim();
        var answer = match.Groups[2].Value.Trim();
        if (thinking.Length > 0) logger.Thinking(thinking);
        if (answer.Length > 0) logger.Agent(answer);
    }
    else
    {
        logger.Agent(text);
    }
}

// --- Logger class - mirrors TS Logger class ---

class Logger
{
    private readonly bool _useColor;

    public Logger()
    {
        _useColor = Environment.GetEnvironmentVariable("SHELL") is not null
                 || Environment.GetEnvironmentVariable("PSModulePath") is not null;
    }

    private string Format(string label, string color) =>
        _useColor ? $"{color}{label}\x1b[0m" : label;

    public void Agent(string msg) =>
        Console.WriteLine($"{Format("Agent", "\x1b[94m")}: {msg}");

    public void User() =>
        Console.Write($"{Format("User", "\x1b[97m")}: ");

    public void Tool(string msg) =>
        Console.WriteLine($"{Format("Tool", "\x1b[32m")}: {msg}");

    public void Thinking(string msg)
    {
        if (_useColor)
            Console.WriteLine($"\x1b[3;90m{msg}\x1b[0m");
        else
            Console.WriteLine($"(thinking) {msg}");
    }

    public Action StartSpinner()
    {
        var frames = new[] { "\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f" };
        var i = 0;
        var cts = new CancellationTokenSource();
        _ = Task.Run(async () =>
        {
            while (!cts.Token.IsCancellationRequested)
            {
                Console.Write($"\r{frames[i++ % frames.Length]}");
                try { await Task.Delay(80, cts.Token); } catch { break; }
            }
        });
        return () =>
        {
            cts.Cancel();
            Console.Write("\r\x1b[K");
        };
    }
}
