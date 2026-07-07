import type { Message, UserSettings } from "@/lib/types";

/**
 * System prompt for the Mermaid-generation agent. Tuned to:
 *  - produce *only* a Mermaid code block by default
 *  - fix syntax errors when the previous attempt failed
 *  - be tolerant of vague or open-ended requests ("what do you recommend?")
 */
export const SYSTEM_PROMPT = `You are a Mermaid diagram generator. The user describes what they want, and you produce a Mermaid diagram.

Default behavior: output ONE valid Mermaid code block inside \`\`\`mermaid fences. Do not include any prose, explanation, or markdown outside the code block unless the user explicitly asks a question about the design.

When the user asks a question (e.g., "what do you recommend for X?"), give a short textual answer AND include a Mermaid diagram illustrating your recommendation, in a code block.

If the previous Mermaid code failed to render, the user will include a parse error message. Fix the syntax error while preserving the diagram's intent. Keep the same diagram type and node structure unless the error forces a change.

Mermaid tips to remember:
- The first non-comment line must be a diagram type keyword (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, gitGraph, mindmap, timeline, etc.).
- Node IDs cannot contain spaces — use CamelCase or snake_case.
- For flowcharts, arrows are: --> (filled), --- (line), -.-> (dotted), ==> (thick).
- Strings with special characters must be quoted: A["Client (web)"].
- Subgraphs use \`subgraph title\` ... \`end\`.

Reply with the code block and nothing else, unless the user asked a design question.`;

/**
 * Build the user message that includes the current code, any render error,
 * and the user's input. This is the "context payload" sent on every turn.
 */
export function buildUserMessage(
  userInput: string,
  currentCode: string,
  renderError: string | null,
): string {
  const sections: string[] = [];

  if (currentCode.trim().length > 0) {
    sections.push(
      `Current diagram:\n\`\`\`mermaid\n${currentCode.trim()}\n\`\`\``,
    );
  } else {
    sections.push("Current diagram: (empty — start from scratch)");
  }

  if (renderError) {
    sections.push(
      `Render error from the previous attempt:\n${renderError}\n\nFix the syntax error above while preserving the diagram's intent.`,
    );
  }

  sections.push(`User request: ${userInput}`);
  return sections.join("\n\n");
}

/**
 * Build the full messages array for the chat completion call.
 * Includes: system prompt, the last N exchanges from history, and the current
 * user request assembled with code/error context.
 */
export function buildMessages(
  history: Message[],
  userInput: string,
  currentCode: string,
  renderError: string | null,
  settings: UserSettings,
  recentTurns = 6,
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // History (excluding the trailing user message we are about to inject).
  // Take the last `recentTurns` *messages* (≈ 3 exchanges).
  const tail = history.slice(-recentTurns);
  for (const m of tail) {
    messages.push({ role: m.role, content: m.content });
  }

  messages.push({
    role: "user",
    content: buildUserMessage(userInput, currentCode, renderError),
  });

  return messages;
}

/**
 * Extract the first ```mermaid ... ``` block from a model response. If no
 * fenced block is found, fall back to returning the entire trimmed response
 * (the LLM may have just printed the code plainly).
 */
export function extractMermaidBlock(text: string): string {
  const fenced = text.match(/```mermaid\s*\n([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // Tolerate models that forget the language tag
  const anyFence = text.match(/```\s*\n([\s\S]*?)```/);
  if (anyFence) return anyFence[1].trim();
  return text.trim();
}
