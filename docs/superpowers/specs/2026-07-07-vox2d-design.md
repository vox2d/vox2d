# vox2d — Design Document

**Date:** 2026-07-07
**Status:** Approved
**Author:** Brainstorming session (mvallebr + team)

---

## Overview

**vox2d** is a web-based "cloud agent" that lets users create and iterate on Mermaid diagrams through natural language (text or voice). The user describes what they want, the LLM generates/edits Mermaid code, the diagram is rendered, and the user can refine with follow-up prompts. History (undo/redo) is built in. Persistence is local-first, with export/import for sharing.

The pain it eliminates: the friction of authoring diagrams. With AI, the natural-language description should be enough — the user should rarely need to touch the underlying code.

---

## Goals (MVP)

1. **Describe → diagram**: user types or speaks a description, the LLM produces valid Mermaid code, the diagram renders.
2. **Iterate**: user gives follow-up prompts ("add a load balancer between these two"), the LLM updates the code, re-renders.
3. **History**: undo/redo over code changes (max 50 snapshots). Keyboard shortcuts.
4. **Multi-view**: Preview, Code, and Split (code left, preview right) tabs in the diagram area.
5. **Self-fix**: when the generated Mermaid fails to render, the agent retries automatically (up to N attempts) with the error context. If still failing, asks the user whether to keep trying or hand back control.
6. **Local-first**: state persists in `localStorage`. Export/import for `.mmd`, `.json`, `.png`, `.svg`.
7. **Voice input**: Web Speech API in the browser (no cost) with optional Whisper fallback for better quality.
8. **Flexible LLM**: works with OpenRouter and Ollama Cloud (both OpenAI-compatible).
9. **Configurable render URL**: official Mermaid live, PlantUML, or self-hosted instances.
10. **Single-user, Docker-deployed**.

## Non-Goals (out of scope for MVP)

- Multi-user real-time collaboration
- Auth / accounts
- Cloud persistence / server-side storage
- Direct visual editing of nodes/edges on the canvas
- Exporting to non-Mermaid formats beyond PNG/SVG
- Production-grade prompt security / jailbreak hardening

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│  ┌───────────────────────────────────────────┐  │
│  │           Diagram Area (top)              │  │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐  │  │
│  │  │ Preview │  │  Code   │  │  Split   │  │  │
│  │  │ (svg)   │  │ (editor)│  │ (L | R)  │  │  │
│  │  └─────────┘  └─────────┘  └──────────┘  │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │           Chat Area (bottom)              │  │
│  │  [messages]  [input]  [🎤]  [export]     │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  localStorage: diagram code + chat history      │
└────────────────────┬────────────────────────────┘
                     │  POST /api/chat (SSE stream)
                     │  POST /api/speech-to-text
                     ▼
┌─────────────────────────────────────────────────┐
│              Next.js API Routes                  │
│                                                 │
│  /api/chat          → proxy → OpenAI client     │
│  /api/speech-to-text → proxy → Whisper API      │
│                                                 │
│  Agent logic: build prompt (code + errors        │
│  + conversation + user input), retry on fail    │
└─────────────────────────────────────────────────┘
                     │
                     ▼
            OpenRouter / Ollama Cloud
```

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Single codebase for UI + API routes, mature streaming support, easy Docker build |
| UI | **MUI** (Material UI) | Pre-built accessible components (Dialog, Tabs, TextField), fast iteration |
| State | **Zustand** | Minimal API, no boilerplate, clean undo/redo over `set()`/`get()` |
| Diagram render | `mermaid` (official) | Runs in browser, returns SVG + parse errors |
| Code editor | CodeMirror 6 + `@codemirror/lang-markdown` | Lightweight, fast, extensible |
| Markdown in chat | `@uiw/react-md-editor` | Built-in preview, syntax highlight |
| LLM client | `openai` (npm) | Both OpenRouter and Ollama Cloud are OpenAI-compatible |
| Speech-to-text | Web Speech API (client) + Whisper fallback (server) | Web Speech is free; Whisper is the high-quality fallback |
| Container | Docker (standalone) | Per user preference — no Vercel |
| CI | GitHub Actions (lint + typecheck + test) | Standard |
| Tests | Vitest + React Testing Library (unit/component), Playwright (E2E, later) | Pragmatic test stack |

---

## Component Breakdown

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx              # MUI ThemeProvider, AppRouterCacheProvider
│   ├── page.tsx                # main shell: diagram area + chat
│   └── api/
│       ├── chat/route.ts       # POST — SSE streaming proxy to LLM
│       └── speech/route.ts     # POST — audio → text (Whisper)
├── components/
│   ├── diagram/
│   │   ├── diagram-panel.tsx    # Tabs: Preview | Code | Split
│   │   ├── diagram-viewer.tsx   # wraps Mermaid.js, captures render errors
│   │   └── code-editor.tsx      # CodeMirror with Mermaid syntax
│   ├── chat/
│   │   ├── chat-panel.tsx       # messages + input + voice button
│   │   ├── chat-message.tsx     # single message (markdown rendered)
│   │   └── audio-recorder.tsx   # Web Speech API + MediaRecorder
│   ├── settings-dialog.tsx      # MUI Dialog: provider, model, render URL
│   ├── export-menu.tsx          # MUI Menu: .mmd, .json, .png, .svg
│   └── theme-provider.tsx       # MUI theme + dark/light toggle
├── lib/
│   ├── mermaid.ts              # render wrapper, returns { svg, error }
│   ├── llm.ts                  # OpenAI client factory (OpenRouter / Ollama)
│   ├── prompt.ts               # system prompt + message builder
│   ├── storage.ts              # localStorage load/save/export/import
│   ├── export.ts               # format-specific export
│   └── types.ts                # shared types
├── store/
│   └── diagram-store.ts        # Zustand: code, history, messages, settings
└── theme.ts                    # MUI theme customization
```

### Component Responsibilities

| Component | Does | Does NOT do |
|---|---|---|
| `diagram-viewer` | Render Mermaid via `mermaid.run()`, return SVG or error | Edit code |
| `code-editor` | Edit Mermaid code with syntax highlight | Render diagram |
| `diagram-panel` | Orchestrate tabs, mount viewer + editor | Fetch from LLM |
| `chat-panel` | Show history, send prompt to `/api/chat`, display streaming response | Render Mermaid |
| `audio-recorder` | Capture audio, transcribe via Web Speech API or post to `/api/speech` | Render Mermaid |
| `settings-dialog` | Edit provider/model/render URL, persist to localStorage | Call LLM |
| `export-menu` | Trigger downloads in various formats | Render Mermaid |
| `diagram-store` | Hold code, history, undo/redo, messages, settings | Persist (delegates to `lib/storage.ts`) |

---

## Data Flow & State

### Zustand Store Shape

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface UserSettings {
  provider: 'openrouter' | 'ollama';
  model: string;
  renderUrl: string;        // default: official Mermaid live
  sttProvider: 'webspeech' | 'whisper' | 'none';
  maxRetryAttempts: number; // default 3
}

interface DiagramState {
  // Current state
  code: string;
  renderError: string | null;

  // History
  history: string[];          // code snapshots, max 50
  historyIndex: number;       // current position in history

  // Chat
  messages: Message[];
  isStreaming: boolean;
  currentStreamContent: string;

  // Config
  settings: UserSettings;

  // Actions
  setCode: (code: string) => void;
  pushHistory: (code: string) => void;
  undo: () => void;
  redo: () => void;
  addMessage: (msg: Message) => void;
  updateStreamingContent: (chunk: string) => void;
  finishStreaming: () => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
}
```

### Undo/Redo Algorithm

```
history: [v1, v2, v3, v4]
historyIndex: 3     ← v4 is current

undo()  → historyIndex: 2  (current code = v3)
redo()  → historyIndex: 3  (current code = v4)
edit at v3 → truncates to [v1, v2, v3] then pushes v3'
           → history: [v1, v2, v3, v3'], historyIndex: 3
```

Keyboard shortcuts: `Ctrl+Z` / `Cmd+Z` (undo), `Ctrl+Shift+Z` / `Cmd+Shift+Z` (redo).

### Persistence

- **Auto-save**: debounced (500ms) write to `localStorage` on any state change (Zustand `persist` middleware).
- **Restore**: on app load, rehydrate from `localStorage`. If empty, start with empty state.
- **Reset**: "New diagram" button clears everything (with confirmation dialog).
- **Export**: `.mmd` (code only), `.json` (full state — code, messages, settings), `.png` (SVG rasterized via canvas), `.svg` (raw SVG).
- **Import**: `.mmd` (just code), `.json` (full state).

### Environment Variables (`.env.example`)

```
LLM_PROVIDER=openrouter          # openrouter | ollama
LLM_MODEL=openai/gpt-4o-mini
OPENROUTER_API_KEY=sk-or-v1-...
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=...
RENDER_URL=https://mermaid.ink   # or self-hosted, or PlantUML
MAX_RETRY_ATTEMPTS=3
STT_PROVIDER=webspeech           # webspeech | whisper | none
```

---

## Agent Logic

### System Prompt

```
You are a Mermaid diagram generator. Output valid Mermaid code inside
```mermaid``` fenced blocks. Do not include explanations, prose, or
markdown outside the code block unless explicitly asked.

If the previous attempt failed to render, the user will provide the
parse error — fix the syntax while preserving the diagram's intent.
```

### Per-Message Payload

```typescript
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  // Last N turns of chat (default: 6 = 3 exchanges) for intent context
  ...recentMessages,
  {
    role: 'user',
    content: `
Current diagram:
\`\`\`mermaid
${currentCode}
\`\`\`

${currentRenderError ? `Render error: ${currentRenderError}\n\nFix the syntax error above.` : ''}

User request: ${userInput}
    `.trim(),
  },
];
```

### Retry Flow

```
User sends prompt
       │
       ▼
POST /api/chat (stream) ──► LLM stream starts
       │
       ▼
Client collects chunks, extracts ```mermaid``` block
       │
       ▼
Mermaid.js renders extracted code
       │
       ├─ OK ──► show preview, push to history, done
       │
       └─ ERROR ──► attempts < maxRetry?
                       │
                       ├─ yes ──► re-POST with retry prompt
                       │         (auto, no user interruption)
                       │
                       └─ no ──► show dialog:
                                "Failed after N attempts.
                                 [Edit code manually]  [Keep trying]  [Cancel]"
```

The retry message includes:
- The code that failed
- The exact parse error from Mermaid.js
- Explicit instruction: "Fix the syntax error above while preserving intent."

---

## Voice Input

### Primary: Web Speech API (client-side)

- Available in Chrome, Edge, Safari (not Firefox by default).
- Zero cost, no network call.
- Continuous listening, interim transcripts, final transcript on stop.

### Fallback: Whisper via `/api/speech`

- Used when Web Speech API is unavailable OR user has `STT_PROVIDER=whisper`.
- Audio captured via `MediaRecorder` → POSTed as `multipart/form-data` to `/api/speech`.
- Server proxies to Whisper (OpenAI or OpenRouter — both expose it).
- Returns transcribed text.

### Provider Selection

`Settings` dialog lets the user pick:
- `Web Speech (browser-native, free)`
- `Whisper (high quality, costs API credits)`
- `None (disable voice input)`

Defaults to `Web Speech` — best UX/cost tradeoff.

---

## API Routes

### `POST /api/chat`

**Request body**:
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "code": "flowchart TD\n  A --> B",
  "renderError": null
}
```

**Behavior**:
1. Build full message array (system + recent history + user payload with code/error context).
2. Open streaming request to LLM (`openai.chat.completions.create({ stream: true, ... })`).
3. Stream chunks back to client via Server-Sent Events (SSE).
4. Read API key/base URL from env (OpenRouter or Ollama) based on `LLM_PROVIDER`.

**Response**: `text/event-stream` with chunks of `delta.content`.

### `POST /api/speech`

**Request body**: `multipart/form-data` with `audio` field (webm/wav/mp3).

**Behavior**:
1. Forward audio to Whisper (OpenAI or OpenRouter).
2. Return transcribed text.

**Response**:
```json
{ "text": "transcribed user input" }
```

---

## Project Structure

```
vox2d/
├── .github/
│   └── workflows/
│       └── ci.yml                  # lint + typecheck + test
├── public/
│   └── favicon.svg
├── src/
│   ├── app/                        # Next.js App Router
│   ├── components/
│   ├── lib/
│   ├── store/
│   └── theme.ts
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── next.config.ts
├── tsconfig.json
├── package.json
├── README.md
└── LICENSE                         # MIT
```

---

## Build & Run

### Development

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
# open http://localhost:3000
```

### Production (Docker)

```bash
docker compose up -d --build
# open http://localhost:3000
```

`Dockerfile` is multi-stage: `node:20-alpine` for deps + build, then `next start` on port 3000.

---

## Risks & Open Questions

1. **Mermaid render errors are sometimes cryptic** — need a clean mapping from raw Mermaid errors to actionable feedback to the LLM. May need trial-and-error.
2. **LLM context size** — feeding the full current code on every retry is fine for typical diagrams but could grow. Cap at 8K tokens in code field if needed.
3. **OpenRouter vs Ollama prompt quality** — different models have different Mermaid competence. Default to a strong model (e.g., `gpt-4o-mini`, `claude-3-5-sonnet`) and let user override.
4. **Web Speech API quirks** — Firefox doesn't support it. The Whisper fallback handles this.
5. **Self-hosting the render URL** — `mermaid.ink` is a free public service but not guaranteed reliable for production. The `RENDER_URL` env var lets users point at their own instance.
6. **No auth = no rate limiting per user** — fine for personal/Docker deployment.

---

## Future (post-MVP)

- Visual node/edge editing on the canvas (the "B" option from earlier brainstorming)
- Diagram-to-diagram transformations ("convert this to a sequence diagram")
- Templates / gallery of common patterns
- Export to DrawIO, Lucid, Mermaid Live shareable URLs
- Multi-user real-time editing
- Server-side persistence (Supabase / SQLite)
- Plugin system for custom renderers / LLM providers
