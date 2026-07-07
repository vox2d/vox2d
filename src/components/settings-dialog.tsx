"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
} from "@mui/material";
import { useDiagramStore } from "@/store/diagram-store";
import { useState, useEffect } from "react";

/**
 * Settings dialog — provider, model, render URL, STT provider, retry budget.
 * Changes are persisted to the Zustand store (which in turn persists to
 * localStorage).
 */
export default function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useDiagramStore((s) => s.settings);
  const updateSettings = useDiagramStore((s) => s.updateSettings);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="LLM Provider"
            value={draft.provider}
            onChange={(e) =>
              setDraft({ ...draft, provider: e.target.value as "openrouter" | "ollama" })
            }
          >
            <MenuItem value="openrouter">OpenRouter</MenuItem>
            <MenuItem value="ollama">Ollama</MenuItem>
          </TextField>

          <TextField
            label="Model"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            helperText="E.g. openai/gpt-4o-mini (OpenRouter) or llama3.1 (Ollama)"
          />

          <TextField
            label="Render URL"
            value={draft.renderUrl}
            onChange={(e) => setDraft({ ...draft, renderUrl: e.target.value })}
            helperText="Mermaid live, PlantUML, or self-hosted (used for image export)"
          />

          <TextField
            select
            label="Speech-to-text"
            value={draft.sttProvider}
            onChange={(e) =>
              setDraft({
                ...draft,
                sttProvider: e.target.value as "webspeech" | "whisper" | "none",
              })
            }
          >
            <MenuItem value="webspeech">Web Speech (browser, free)</MenuItem>
            <MenuItem value="whisper">Whisper (server, high quality)</MenuItem>
            <MenuItem value="none">Disabled</MenuItem>
          </TextField>

          <TextField
            type="number"
            label="Max auto-retry attempts"
            value={draft.maxRetryAttempts}
            onChange={(e) =>
              setDraft({
                ...draft,
                maxRetryAttempts: Math.max(0, Number(e.target.value)),
              })
            }
            inputProps={{ min: 0, max: 10 }}
            helperText="How many times to retry if the LLM produces invalid Mermaid"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            updateSettings(draft);
            onClose();
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
