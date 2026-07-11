import OpenAI from "openai";
import type { LlmProvider } from "@/lib/types";

/**
 * Build an OpenAI-compatible client for the configured provider.
 * - OpenRouter: uses OPENROUTER_API_KEY + OPENROUTER_BASE_URL
 * - Ollama:     uses OLLAMA_BASE_URL + OLLAMA_API_KEY (Ollama Cloud requires
 *               a key, but self-hosted can leave it blank)
 *
 * The function is intentionally pure (only reads env at call time) so tests
 * can mock env without re-importing.
 */
export function createLlmClient(provider: LlmProvider): OpenAI {
  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Add it to .env.local.",
      );
    }
    return new OpenAI({
      apiKey,
      baseURL:
        process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    });
  }
  if (provider === "ollama") {
    const baseURL = process.env.OLLAMA_BASE_URL ?? "https://ollama.com";
    const apiKey = process.env.OLLAMA_API_KEY ?? "ollama"; // Ollama accepts any non-empty key
    return new OpenAI({ apiKey, baseURL: `${baseURL}/v1` });
  }
  throw new Error(`Unknown LLM provider: ${provider}`);
}

export function getDefaultModel(provider: LlmProvider): string {
  if (provider === "openrouter") return "openai/gpt-oss-120b:free";
  return "llama3.1";
}

export function resolveModel(
  provider: LlmProvider,
  requested?: string,
): string {
  if (requested && requested.trim().length > 0) return requested;
  return process.env.LLM_MODEL ?? getDefaultModel(provider);
}
