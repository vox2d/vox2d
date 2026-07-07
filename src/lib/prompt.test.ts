import { describe, it, expect } from "vitest";
import { extractMermaidBlock, buildUserMessage } from "@/lib/prompt";

describe("extractMermaidBlock", () => {
  it("extracts a fenced ```mermaid block", () => {
    const out = extractMermaidBlock("Here is your diagram:\n```mermaid\nflowchart TD\n  A --> B\n```\nDone.");
    expect(out).toBe("flowchart TD\n  A --> B");
  });

  it("falls back to a fenced block with no language tag", () => {
    const out = extractMermaidBlock("```\nflowchart TD\n  A --> B\n```");
    expect(out).toBe("flowchart TD\n  A --> B");
  });

  it("returns the entire trimmed text if no fence is present", () => {
    const out = extractMermaidBlock("flowchart TD\n  A --> B");
    expect(out).toBe("flowchart TD\n  A --> B");
  });
});

describe("buildUserMessage", () => {
  it("includes the current code, error, and user request", () => {
    const msg = buildUserMessage("add a load balancer", "flowchart TD\n  A --> B", "Parse error on line 2");
    expect(msg).toContain("flowchart TD");
    expect(msg).toContain("Parse error on line 2");
    expect(msg).toContain("add a load balancer");
  });

  it("handles an empty diagram", () => {
    const msg = buildUserMessage("start fresh", "", null);
    expect(msg).toContain("(empty — start from scratch)");
    expect(msg).not.toContain("Render error");
  });
});
