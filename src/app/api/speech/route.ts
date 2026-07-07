import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createLlmClient } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Speech-to-text proxy. Accepts an audio file (multipart/form-data) and
 * forwards it to Whisper via the configured OpenAI-compatible provider.
 *
 * Only OpenRouter is currently wired up here — Ollama Cloud does not yet
 * expose a Whisper-compatible endpoint. To add Ollama STT, swap the client
 * creation for a direct HTTP call.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return new Response("Missing 'audio' file in form-data", { status: 400 });
  }

  let client: OpenAI;
  try {
    client = createLlmClient("openrouter");
  } catch (err) {
    return new Response(
      `STT init failed (is OPENROUTER_API_KEY set?): ${
        err instanceof Error ? err.message : String(err)
      }`,
      { status: 500 },
    );
  }

  try {
    const transcription = await client.audio.transcriptions.create({
      file,
      model: "openai/whisper-large-v3",
    });
    return Response.json({ text: transcription.text });
  } catch (err) {
    return new Response(
      `Whisper call failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 },
    );
  }
}
