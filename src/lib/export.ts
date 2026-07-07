import { downloadFile } from "@/lib/storage";
import type { PersistedState } from "@/lib/types";

/**
 * Export the current state as a JSON file (full session) or a `.mmd` file
 * (just the Mermaid code).
 */
export function exportJson(state: PersistedState): void {
  const payload = JSON.stringify(state, null, 2);
  downloadFile(
    `vox2d-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    payload,
    "application/json",
  );
}

export function exportMmd(code: string): void {
  downloadFile(
    `vox2d-${new Date().toISOString().replace(/[:.]/g, "-")}.mmd`,
    code,
    "text/plain",
  );
}

/**
 * Export the current diagram as SVG (raw Mermaid output) or as PNG
 * (rasterized via a Canvas in the browser).
 */
export function exportSvg(svg: string): void {
  downloadFile(
    `vox2d-${new Date().toISOString().replace(/[:.]/g, "-")}.svg`,
    svg,
    "image/svg+xml",
  );
}

export async function exportPng(svg: string): Promise<void> {
  if (typeof window === "undefined") return;
  // Encode the SVG into a Blob, then rasterize onto a Canvas.
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG into image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 1200;
    canvas.height = img.naturalHeight || 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.fillStyle = "#0f1115"; // match dark background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const png = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = png;
    a.download = `vox2d-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Parse a JSON file previously exported with `exportJson`. Returns `null` on
 * any error so the caller can show a user-friendly message.
 */
export async function importJsonFile(file: File): Promise<PersistedState | null> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as PersistedState;
    if (typeof parsed.code !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
