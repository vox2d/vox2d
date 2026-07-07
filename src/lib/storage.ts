import type { PersistedState, UserSettings } from "@/lib/types";

const STORAGE_KEY = "vox2d:state:v1";

/**
 * Build the default settings from environment variables. Only available on
 * the client. Falls back to safe defaults if env is missing.
 */
export function defaultSettings(): UserSettings {
  return {
    provider:
      (process.env.NEXT_PUBLIC_LLM_PROVIDER as UserSettings["provider"]) ??
      "openrouter",
    model: process.env.NEXT_PUBLIC_LLM_MODEL ?? "openai/gpt-4o-mini",
    renderUrl:
      process.env.NEXT_PUBLIC_RENDER_URL ?? "https://mermaid.ink",
    sttProvider:
      (process.env.NEXT_PUBLIC_STT_PROVIDER as UserSettings["sttProvider"]) ??
      "webspeech",
    maxRetryAttempts: Number(
      process.env.NEXT_PUBLIC_MAX_RETRY_ATTEMPTS ?? "3",
    ),
  };
}

/**
 * Load persisted state from localStorage. Returns `null` on any failure
 * (missing key, parse error, schema mismatch) so the caller can fall back to
 * defaults without crashing.
 */
export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (typeof parsed.code !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded / disabled — silently ignore. Export still works.
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Download a string as a file. Used by the export menu.
 */
export function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
