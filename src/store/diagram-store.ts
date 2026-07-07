"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DiagramState, Message, UserSettings } from "@/lib/types";
import { defaultSettings } from "@/lib/storage";

const MAX_HISTORY = 50;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface StoreActions {
  // code / history
  setCode: (code: string) => void;
  pushHistory: (code: string) => void;
  undo: () => void;
  redo: () => void;
  // rendering
  setRenderError: (error: string | null) => void;
  // chat
  addMessage: (msg: Omit<Message, "id" | "timestamp">) => Message;
  appendStreamChunk: (id: string, chunk: string) => void;
  finishStream: (id: string) => void;
  clearMessages: () => void;
  // settings
  updateSettings: (partial: Partial<UserSettings>) => void;
  // lifecycle
  resetAll: () => void;
}

export type Store = DiagramState & StoreActions;

/**
 * Centralized state for the diagram, chat, and settings. The `persist`
 * middleware auto-saves to localStorage on every change (with a small
 * debounce inside Zustand).
 */
export const useDiagramStore = create<Store>()(
  persist(
    (set, get) => ({
      // initial state
      code: "",
      renderError: null,
      history: [""],
      historyIndex: 0,
      messages: [],
      isStreaming: false,
      currentStreamId: null,
      settings: defaultSettings(),

      // ─── code / history ────────────────────────────────────────
      setCode: (code: string) => set({ code }),

      pushHistory: (code: string) => {
        const { history, historyIndex } = get();
        // Truncate any "redo" tail beyond historyIndex, then push.
        const truncated = history.slice(0, historyIndex + 1);
        truncated.push(code);
        // Cap at MAX_HISTORY (drop the oldest).
        const capped =
          truncated.length > MAX_HISTORY
            ? truncated.slice(truncated.length - MAX_HISTORY)
            : truncated;
        set({
          history: capped,
          historyIndex: capped.length - 1,
          code,
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;
        const next = historyIndex - 1;
        set({ historyIndex: next, code: history[next] });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const next = historyIndex + 1;
        set({ historyIndex: next, code: history[next] });
      },

      // ─── rendering ─────────────────────────────────────────────
      setRenderError: (error: string | null) => set({ renderError: error }),

      // ─── chat ──────────────────────────────────────────────────
      addMessage: (msg) => {
        const full: Message = {
          ...msg,
          id: newId(),
          timestamp: Date.now(),
        };
        set((s) => ({
          messages: [...s.messages, full],
          isStreaming:
            msg.role === "assistant" && !s.isStreaming
              ? true
              : s.isStreaming,
          currentStreamId:
            msg.role === "assistant" ? full.id : s.currentStreamId,
        }));
        return full;
      },

      appendStreamChunk: (id: string, chunk: string) => {
        set((s: Store) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + chunk } : m,
          ),
        }));
      },

      finishStream: (id: string) => {
        set((s: Store) => ({
          isStreaming: false,
          currentStreamId: s.currentStreamId === id ? null : s.currentStreamId,
        }));
      },

      clearMessages: () =>
        set({ messages: [], isStreaming: false, currentStreamId: null }),

      // ─── settings ──────────────────────────────────────────────
      updateSettings: (partial: Partial<UserSettings>) =>
        set((s: Store) => ({ settings: { ...s.settings, ...partial } })),

      // ─── lifecycle ─────────────────────────────────────────────
      resetAll: () =>
        set({
          code: "",
          renderError: null,
          history: [""],
          historyIndex: 0,
          messages: [],
          isStreaming: false,
          currentStreamId: null,
        }),
    }),
    {
      name: "vox2d:state:v1",
      storage: createJSONStorage(() => localStorage),
      // Don't persist transient flags
      partialize: (s: Store) => ({
        code: s.code,
        history: s.history,
        historyIndex: s.historyIndex,
        messages: s.messages,
        settings: s.settings,
      }),
    },
  ),
);
