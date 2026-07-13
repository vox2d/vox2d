#!/usr/bin/env bash
# dev-local.sh — dev server que carrega OPENROUTER_VOX2D_KEY do cofre ~/.shared-env.sh
# Uso: npm run dev:local
#
# A variavel OPENROUTER_VOX2D_KEY (em ~/.shared-env.sh) e renomeada para
# OPENROUTER_API_KEY (que e o nome que o Next.js espera) e exportada no
# process.env antes de subir o dev server. Isso evita colocar a chave
# literal no .env.local (que vai pro git via dotenv-file).

set -euo pipefail

VAULT="${HOME}/.shared-env.sh"

if [ -f "$VAULT" ]; then
  # shellcheck disable=SC1090
  source "$VAULT"
else
  echo "[dev:local] AVISO: $VAULT nao encontrado" >&2
fi

if [ -n "${OPENROUTER_VOX2D_KEY:-}" ]; then
  export OPENROUTER_API_KEY="$OPENROUTER_VOX2D_KEY"
  echo "[dev:local] OPENROUTER_API_KEY exportada (${#OPENROUTER_API_KEY} chars)"
else
  echo "[dev:local] AVISO: OPENROUTER_VOX2D_KEY vazia ou indefinida — LLM nao vai funcionar" >&2
fi

exec npx next dev
