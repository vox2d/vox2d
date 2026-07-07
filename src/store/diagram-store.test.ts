import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "@/store/diagram-store";

// The store uses Zustand's `persist` middleware with localStorage. jsdom
// provides a working localStorage, so the test exercises the real store.
describe("diagram-store", () => {
  beforeEach(() => {
    localStorage.clear();
    useDiagramStore.setState({
      code: "",
      history: [""],
      historyIndex: 0,
      messages: [],
    });
  });

  it("pushHistory truncates redo tail and updates index", () => {
    const { pushHistory } = useDiagramStore.getState();
    pushHistory("v1");
    pushHistory("v2");
    pushHistory("v3");
    expect(useDiagramStore.getState().history).toEqual(["", "v1", "v2", "v3"]);
    expect(useDiagramStore.getState().historyIndex).toBe(3);

    // Undo twice, then push — should truncate the "redo" tail.
    useDiagramStore.getState().undo();
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().historyIndex).toBe(1);
    pushHistory("v2-bis");
    expect(useDiagramStore.getState().history).toEqual(["", "v1", "v2-bis"]);
    expect(useDiagramStore.getState().historyIndex).toBe(2);
  });

  it("undo and redo are no-ops at the boundaries", () => {
    const { undo, redo } = useDiagramStore.getState();
    undo();
    redo();
    expect(useDiagramStore.getState().historyIndex).toBe(0);
  });

  it("resetAll clears the state", () => {
    useDiagramStore.getState().pushHistory("hello");
    useDiagramStore.getState().addMessage({ role: "user", content: "x" });
    useDiagramStore.getState().resetAll();
    expect(useDiagramStore.getState().code).toBe("");
    expect(useDiagramStore.getState().history).toEqual([""]);
    expect(useDiagramStore.getState().messages).toEqual([]);
  });
});
