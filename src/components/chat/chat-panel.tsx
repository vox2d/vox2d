"use client";

import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
  Stack,
  Tooltip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import { useState, useRef, useEffect } from "react";
import { useDiagramStore } from "@/store/diagram-store";
import ChatMessage from "@/components/chat/chat-message";
import AudioRecorder from "@/components/chat/audio-recorder";
import { extractMermaidBlock } from "@/lib/prompt";
import type { Message } from "@/lib/types";

/**
 * Chat panel: message list + input row (with voice button) + a small
 * "thinking/retrying" indicator. Sends prompts to /api/chat (SSE stream).
 *
 * The retry loop lives here on the client because:
 *  - The Mermaid render error is only known on the client
 *  - Showing the user "agent is fixing..." is a UI concern
 *  - We can cancel / let the user take over mid-retry
 */
export default function ChatPanel() {
  const messages = useDiagramStore((s) => s.messages);
  const isStreaming = useDiagramStore((s) => s.isStreaming);
  const currentStreamId = useDiagramStore((s) => s.currentStreamId);
  const settings = useDiagramStore((s) => s.settings);
  const pushHistory = useDiagramStore((s) => s.pushHistory);
  const addMessage = useDiagramStore((s) => s.addMessage);
  const appendStreamChunk = useDiagramStore((s) => s.appendStreamChunk);
  const finishStream = useDiagramStore((s) => s.finishStream);

  const [input, setInput] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  /**
   * Send a user prompt and stream the assistant's response. On completion,
   * extract the Mermaid block, attempt to render (via re-running the viewer
   * effect on store change), and if there's a render error, retry up to
   * `maxRetryAttempts` times.
   */
  async function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || isStreaming) return;

    addMessage({ role: "user", content: trimmed });
    setInput("");

    // Snapshot current state for the request
    const state = useDiagramStore.getState();
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.messages.map((m) => ({ role: m.role, content: m.content })).concat([
          { role: "user" as const, content: trimmed },
        ]),
        code: state.code,
        renderError: state.renderError,
        settings: state.settings,
      }),
    });
    if (!resp.ok || !resp.body) {
      addMessage({
        role: "assistant",
        content: `Error: ${resp.status} ${resp.statusText}`,
      });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    let buffer = "";
    // Reserve a placeholder assistant message to stream into
    const assistantMsg = addMessage({ role: "assistant", content: "" });
    const assistantId = assistantMsg.id;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE messages separated by blank lines
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as { content?: string };
          const chunk = json.content ?? "";
          if (chunk) {
            acc += chunk;
            appendStreamChunk(assistantId, chunk);
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }
    finishStream(assistantId);

    // Try to apply the Mermaid code, then retry on render failure
    const code = extractMermaidBlock(acc);
    if (code && code !== state.code) {
      useDiagramStore.getState().setCode(code);
      pushHistory(code);
    }

    // Wait one tick for the viewer to attempt the render
    await new Promise((r) => setTimeout(r, 250));
    let attempts = 0;
    setRetrying(true);
    while (
      useDiagramStore.getState().renderError &&
      attempts < settings.maxRetryAttempts
    ) {
      attempts += 1;
      const errState = useDiagramStore.getState();
      const retryResp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: errState.messages,
          code: errState.code,
          renderError: errState.renderError,
          settings: errState.settings,
          isRetry: true,
          attempt: attempts,
        }),
      });
      if (!retryResp.ok || !retryResp.body) break;
      const rReader = retryResp.body.getReader();
      let rAcc = "";
      const rMsg = addMessage({ role: "assistant", content: "" });
      let rBuf = "";
      while (true) {
        const { done, value } = await rReader.read();
        if (done) break;
        rBuf += decoder.decode(value, { stream: true });
        const rParts = rBuf.split("\n\n");
        rBuf = rParts.pop() ?? "";
        for (const part of rParts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as { content?: string };
            const chunk = json.content ?? "";
            if (chunk) {
              rAcc += chunk;
              appendStreamChunk(rMsg.id, chunk);
            }
          } catch {
            // ignore
          }
        }
      }
      finishStream(rMsg.id);
      const retryCode = extractMermaidBlock(rAcc);
      if (retryCode && retryCode !== useDiagramStore.getState().code) {
        useDiagramStore.getState().setCode(retryCode);
        pushHistory(retryCode);
      }
      // Wait for re-render
      await new Promise((r) => setTimeout(r, 250));
    }
    setRetrying(false);

    if (useDiagramStore.getState().renderError) {
      const keep = window.confirm(
        `The agent couldn't produce a renderable diagram after ${settings.maxRetryAttempts} retries.\n\n` +
          `Click OK to let the agent keep trying, or Cancel to stop and let you edit the code manually.`,
      );
      if (keep) {
        // Trigger one more retry by re-sending the last user message
        const lastUser = [...useDiagramStore.getState().messages]
          .reverse()
          .find((m: Message) => m.role === "user");
        if (lastUser) await send(lastUser.content);
      }
    }
  }

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 2,
          py: 1,
        }}
      >
        {messages.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, textAlign: "center" }}
          >
            Try: &quot;Draw a flowchart for a publish/subscribe system&quot;
          </Typography>
        ) : (
          <Stack spacing={1}>
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} isStreaming={m.id === currentStreamId} />
            ))}
            {retrying && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  agent is fixing a render error…
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </Box>
      <Paper
        square
        elevation={0}
        sx={{
          borderTop: 1,
          borderColor: "divider",
          p: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Describe the diagram you want… (Enter to send, Shift+Enter for newline)"
            disabled={isStreaming}
            size="small"
          />
          {settings.sttProvider !== "none" && (
            <Tooltip title="Voice input">
              <IconButton
                onClick={() => setRecorderOpen((v) => !v)}
                color={recorderOpen ? "primary" : "default"}
              >
                <MicIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Send">
            <span>
              <IconButton
                onClick={() => send(input)}
                disabled={isStreaming || !input.trim()}
                color="primary"
              >
                <SendIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {recorderOpen && (
          <Box sx={{ mt: 1 }}>
            <AudioRecorder
              provider={settings.sttProvider}
              onTranscript={(text) => {
                setInput((prev) => (prev ? prev + " " : "") + text);
                setRecorderOpen(false);
              }}
              onClose={() => setRecorderOpen(false)}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
