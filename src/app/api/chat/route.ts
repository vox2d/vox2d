import { NextRequest } from "next/server";
import { createLlmClient, resolveModel } from "@/lib/llm";
import { buildMessages, SYSTEM_PROMPT } from "@/lib/prompt";
import type { Message, UserSettings } from "@/lib/types";

export const runtime = "nodejs"; // OpenAI SDK uses Node streams
export const dynamic = "force-dynamic";

interface ChatMessagePayload {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessagePayload[];
  code: string;
  renderError: string | null;
  settings: UserSettings;
  isRetry?: boolean;
  attempt?: number;
}

/**
 * Streaming chat endpoint. Accepts the user's request + current diagram state
 * and forwards a streaming completion to the configured LLM provider.
 *
 * The response is Server-Sent Events (SSE), one JSON-encoded chunk per event:
 *
 *   data: {"content":"flow"}
 *   data: {"content":"chart"}
 *   data: [DONE]
 *
 * The client parses these and updates the UI incrementally.
 */
export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages, code, renderError, settings, isRetry, attempt } = body;

  // The client's `messages` already includes the user turn. We treat the last
  // message as the user's prompt; everything before is history.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return new Response("No user message in conversation", { status: 400 });
  }
  const historyMessages: Message[] = messages.map((m, i) => ({
    id: `h-${i}`,
    role: m.role,
    content: m.content,
    timestamp: 0,
  }));

  const fullMessages = buildMessages(
    historyMessages,
    lastUser.content,
    code,
    renderError,
    settings,
  );

  // If this is a retry, append a stronger system nudge to encourage a fix.
  if (isRetry) {
    fullMessages[0] = {
      ...fullMessages[0],
      content:
        SYSTEM_PROMPT +
        `\n\nThis is retry #${attempt ?? "?"}. The previous output failed to render in Mermaid.js. The parse error was already shown to you. Focus on producing syntactically valid Mermaid that addresses the error.`,
    };
  }

  let client;
  try {
    client = createLlmClient(settings.provider);
  } catch (err) {
    return new Response(
      `LLM client init failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 },
    );
  }

  const model = resolveModel(settings.provider, settings.model);

  let stream;
  try {
    stream = await client.chat.completions.create({
      model,
      messages: fullMessages,
      stream: true,
      temperature: 0.2,
    });
  } catch (err) {
    return new Response(
      `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`),
            );
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              content: `\n\n[stream error: ${
                err instanceof Error ? err.message : String(err)
              }]`,
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
