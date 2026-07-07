# vox2d

> Describe a diagram in plain English (or speak it) and watch it appear.

vox2d is a web-based "cloud agent" that turns natural-language prompts into
[Mermaid](https://mermaid.js.org/) diagrams. The LLM generates the Mermaid
source, the browser renders it, and the user iterates by talking. History
(undo/redo) and auto-retry on render errors are built in.

## Features

- **Text or voice prompts** — type or speak (Web Speech API + optional Whisper fallback)
- **Live preview** — rendered Mermaid, code editor, or split view
- **Self-healing** — when the LLM produces invalid Mermaid, the agent auto-retries with the parse error
- **History** — undo/redo over the last 50 code snapshots
- **Local-first** — state persists in `localStorage`; export/import as JSON
- **Multi-provider** — works with OpenRouter or Ollama Cloud
- **Configurable render** — point at `mermaid.ink`, PlantUML, or your own instance

## Quick start

### Development

```bash
git clone https://github.com/vox2d/vox2d.git
cd vox2d
cp .env.example .env.local       # fill in your LLM keys
npm install
npm run dev                       # http://localhost:3000
```

### Production (Docker)

```bash
cp .env.example .env.local        # fill in your LLM keys
docker compose up -d --build      # http://localhost:3000
```

## Configuration

All configuration is via environment variables (see [`.env.example`](.env.example)):

| Variable | Description | Default |
|---|---|---|
| `LLM_PROVIDER` | `openrouter` or `ollama` | `openrouter` |
| `LLM_MODEL` | Model identifier | `openai/gpt-4o-mini` |
| `OPENROUTER_API_KEY` | Required for OpenRouter | — |
| `OLLAMA_BASE_URL` | Ollama base URL | `https://ollama.com` |
| `OLLAMA_API_KEY` | Required for Ollama Cloud (any value works for self-hosted) | — |
| `RENDER_URL` | Mermaid/PlantUML service | `https://mermaid.ink` |
| `STT_PROVIDER` | `webspeech`, `whisper`, or `none` | `webspeech` |
| `MAX_RETRY_ATTEMPTS` | Auto-retry budget when Mermaid fails to render | `3` |

You can also change provider/model/render URL at runtime via the **Settings** dialog.

## Architecture

```
Browser (React + MUI)                Next.js API routes              LLM
┌──────────────────────┐            ┌─────────────────────┐         ┌──────────┐
│ DiagramArea (top)    │   POST     │ /api/chat           │  OpenAI │ OpenRouter│
│  Preview/Code/Split  │ ─────────► │  - build prompt     │ ───────►│  / Ollama │
│                      │   SSE      │  - stream response  │  compat │  Cloud    │
│ ChatPanel (bottom)   │ ◄───────── │                     │         └──────────┘
│  history + input     │            │ /api/speech         │         ┌──────────┐
│  + voice button      │   audio    │  - Whisper proxy    │ ───────►│ Whisper  │
└──────────────────────┘ ─────────► └─────────────────────┘         └──────────┘
       │
       └── Zustand store (code, history, messages, settings)
              │
              └── persisted to localStorage
```

State management uses [Zustand](https://github.com/pmndrs/zustand) with the
`persist` middleware. The retry loop runs on the client because the Mermaid
render error is only known after attempting to render in the browser.

## Project layout

```
src/
├── app/                     # Next.js App Router
│   ├── api/chat/            # SSE streaming LLM proxy
│   └── api/speech/          # Whisper STT proxy
├── components/
│   ├── diagram/             # Panel + viewer + code editor
│   └── chat/                # Panel + message + audio recorder
├── lib/                     # mermaid, llm, prompt, storage, export
├── store/                   # Zustand store
├── theme.ts                 # MUI theme
├── app/layout.tsx
└── app/page.tsx
```

See [`docs/superpowers/specs/2026-07-07-vox2d-design.md`](docs/superpowers/specs/2026-07-07-vox2d-design.md) for the full design document.

## Roadmap

- Visual node/edge editing on the canvas
- Diagram-to-diagram transformations ("convert this to a sequence diagram")
- Templates / gallery of common patterns
- Multi-user real-time editing
- Server-side persistence

## License

MIT — see [LICENSE](LICENSE).
