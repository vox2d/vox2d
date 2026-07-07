import mermaid from "mermaid";
import type { UserSettings } from "@/lib/types";

/**
 * Initialize Mermaid once on the client. Safe to call multiple times — Mermaid
 * is idempotent on re-initialization.
 */
let initialized = false;
function init(renderUrl: string) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "dark",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    // The renderUrl hint is recorded only for debugging; Mermaid itself always
    // renders inline on the client. The RENDER_URL env var is also exposed to
    // external tools (export-as-image, etc.) via window.__VOX2D_RENDER_URL__.
  });
  if (typeof window !== "undefined") {
    (window as unknown as { __VOX2D_RENDER_URL__?: string }).__VOX2D_RENDER_URL__ =
      renderUrl;
  }
  initialized = true;
}

export interface RenderResult {
  ok: boolean;
  svg?: string;
  error?: string;
}

/**
 * Render a Mermaid source string into an SVG string. Returns a structured
 * result so callers can decide whether to retry via the LLM.
 *
 * IMPORTANT: Mermaid v11 uses async render() that returns an object with
 * `svg`. The legacy `render()` returning a string was removed.
 */
export async function renderMermaid(
  code: string,
  settings: UserSettings,
): Promise<RenderResult> {
  if (!initialized) init(settings.renderUrl);
  try {
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await mermaid.render(id, code);
    return { ok: true, svg: result.svg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
