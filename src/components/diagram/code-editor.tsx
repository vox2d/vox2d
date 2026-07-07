"use client";

import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { useDiagramStore } from "@/store/diagram-store";

/**
 * CodeMirror 6 editor wired to the Mermaid code in the Zustand store.
 * Edits push a new history snapshot so undo/redo behaves intuitively.
 */
export default function CodeEditor() {
  const code = useDiagramStore((s) => s.code);
  const setCode = useDiagramStore((s) => s.setCode);
  const pushHistory = useDiagramStore((s) => s.pushHistory);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Suppress history push when the change is a sync from outside the editor
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateListener = EditorView.updateListener.of((u) => {
      if (u.docChanged && !syncingRef.current) {
        const next = u.state.doc.toString();
        setCode(next);
        // Debounced history push: simple version, push on every change
        // (caller can cap with MAX_HISTORY inside the store).
        pushHistory(next);
      }
    });

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // We only want to (re)create the editor once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external code changes (e.g. from streaming LLM response) into the
  // editor without triggering our own update loop.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      syncingRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
      syncingRef.current = false;
    }
  }, [code]);

  // Global undo/redo shortcuts — the store's undo/redo operate on diagram
  // history, which is what the user expects.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        overflow: "auto",
        background: "#0f1115",
        fontSize: 13,
      }}
    />
  );
}
