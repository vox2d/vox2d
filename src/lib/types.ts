/**
 * Shared types used across the store, lib, and components.
 */

export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

export type LlmProvider = "openrouter" | "ollama";
export type SttProvider = "webspeech" | "whisper" | "none";

export interface UserSettings {
  provider: LlmProvider;
  model: string;
  renderUrl: string;
  sttProvider: SttProvider;
  maxRetryAttempts: number;
}

export type DiagramView = "preview" | "code" | "split";

/**
 * Mutable in-memory diagram state. Excludes the action functions, which are
 * defined alongside the Zustand store.
 */
export interface DiagramState {
  code: string;
  renderError: string | null;
  history: string[];
  historyIndex: number;
  messages: Message[];
  isStreaming: boolean;
  currentStreamId: string | null;
  settings: UserSettings;
}

/**
 * Persisted state shape. Used by the Zustand `persist` middleware and by the
 * JSON export/import.
 */
export interface PersistedState {
  code: string;
  history: string[];
  historyIndex: number;
  messages: Message[];
  settings: UserSettings;
}
