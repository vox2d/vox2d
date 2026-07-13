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

### 1. Get an OpenRouter API key

The default model is **`openai/gpt-oss-120b:free`** — no credits needed. To use any other model (including paid ones), you'll need a free OpenRouter account:

1. Sign up at <https://openrouter.ai>
2. Create a key at <https://openrouter.ai/keys>
3. (Optional) Buy credits once at <https://openrouter.ai/credits> — unlocks higher rate limits on `:free` models and access to paid ones. **One purchase of ≥ $10 unlocks 1000 free requests/day forever.**

### 2. Set up your secret

Pick **one** approach:

#### Option A — `.env.local` (simplest)

The file is in `.gitignore`, so it's never committed:

```bash
cp .env.example .env.local
# paste your key after OPENROUTER_API_KEY=
```

#### Option B — shared vault at `~/.shared-env.sh` (recommended for multi-project)

Keeps the key in one place on your machine instead of duplicated across repos:

```bash
# one-time, in any directory:
cat >> ~/.shared-env.sh <<'EOF'
export OPENROUTER_VOX2D_KEY="sk-or-v1-..."
EOF
chmod 600 ~/.shared-env.sh
```

Then in vox2d, use `npm run dev:local` (auto-sources the vault and renames `OPENROUTER_VOX2D_KEY` → `OPENROUTER_API_KEY` for Next):

```bash
npm run dev:local   # picks up the vault key
```

### 3. Run the dev server

```bash
git clone https://github.com/vox2d/vox2d.git
cd vox2d
npm install

# pick one:
npm run dev          # uses OPENROUTER_API_KEY from .env.local
npm run dev:local    # uses OPENROUTER_VOX2D_KEY from ~/.shared-env.sh
```

Open <http://localhost:3000> (or the next-available port if 3000 is in use).

### Production (Docker)

```bash
cp .env.example .env.local        # fill in your LLM keys
docker compose up -d --build      # http://localhost:3000
```

## Configuration

All configuration is via environment variables (see [`.env.example`](.env.example)):

| Variable | Required | Description | Default |
|---|---|---|---|
| `LLM_PROVIDER` | no | `openrouter` or `ollama` | `openrouter` |
| `LLM_MODEL` | no | Model identifier (e.g., `openai/gpt-oss-120b:free`) | `openai/gpt-oss-120b:free` |
| `OPENROUTER_API_KEY` | yes for OpenRouter | Your key from <https://openrouter.ai/keys> | — |
| `OPENROUTER_BASE_URL` | no | Override OpenRouter base URL | `https://openrouter.ai/api/v1` |
| `OLLAMA_BASE_URL` | yes for Ollama | Ollama base URL | `https://ollama.com` |
| `OLLAMA_API_KEY` | yes for Ollama Cloud | Any value works for self-hosted | `ollama` |
| `RENDER_URL` | no | Mermaid/PlantUML service used for image export | `https://mermaid.ink` |
| `STT_PROVIDER` | no | `webspeech`, `whisper`, or `none` | `webspeech` |
| `MAX_RETRY_ATTEMPTS` | no | Auto-retry budget on Mermaid render failures | `3` |
| `DEBUG_LLM` | no | Log every LLM request/response (verbose) | `false` |

You can also change provider/model/render URL at runtime via the **Settings** dialog.

## Choosing a model

vox2d defaults to `openai/gpt-oss-120b:free` — the highest-quality free model on OpenRouter as of mid-2026 (117B MoE from OpenAI). Swap anytime via the Settings dialog or `.env.local`.

### Free models (`:free` suffix, no credits needed)

All `:free` models share the same rate limit:

- **~20 requests/minute** (per account, across all `:free` models)
- **50 requests/day** on a fresh account
- **1000 requests/day** if you've ever purchased ≥ $10 in credits (one-time unlock, not a subscription)

> Retries from the self-healing loop count separately. A single user prompt can spend 1–4 requests when the first response fails to render.
>
> Reference: <https://openrouter.ai/docs/api/reference/limits>

Good picks for Mermaid diagram generation:

| Model | Notes |
|---|---|
| `openai/gpt-oss-120b:free` | 117B MoE, strong reasoning — default |
| `qwen/qwen-2.5-coder-32b-instruct:free` | coder-fine-tuned, best for syntax accuracy |
| `tencent/hy3:free` | 295B MoE, agentic/coding optimized |

Browse the full list: <https://openrouter.ai/collections/free-models>

### Paid models (needs credits, no daily cap)

- `openai/gpt-4o-mini` — fast & cheap (~$0.60/M input, ~$2.40/M output)
- `anthropic/claude-3.5-sonnet` — higher-quality output

### Ollama (self-hosted or Cloud)

Drop-in replacements work directly in `.env.local`:

```bash
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1
# OLLAMA_BASE_URL=http://localhost:11434    # local
# OLLAMA_API_KEY=anything                  # self-hosted
```

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
scripts/
└── dev-local.sh             # sources ~/.shared-env.sh and runs next dev
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
