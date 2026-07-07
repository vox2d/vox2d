"use client";

import { Box, Typography, Paper } from "@mui/material";
import MDEditor from "@uiw/react-md-editor";
import type { Message } from "@/lib/types";

/**
 * Single chat message. User messages are right-aligned bubbles; assistant
 * messages render markdown via @uiw/react-md-editor (so code blocks are
 * highlighted and copyable). Streaming messages show a subtle cursor.
 */
export default function ChatMessage({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: "85%",
          px: 1.5,
          py: 1,
          bgcolor: isUser ? "primary.dark" : "background.default",
          color: isUser ? "primary.contrastText" : "text.primary",
          borderRadius: 2,
        }}
      >
        <Typography
          variant="caption"
          sx={{ opacity: 0.7, display: "block", mb: 0.5 }}
        >
          {isUser ? "You" : "vox2d"}
        </Typography>
        {isUser ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
        ) : (
          <Box data-color-mode="dark">
            <MDEditor.Markdown
              source={message.content + (isStreaming ? "▍" : "")}
              style={{ background: "transparent", color: "inherit", fontSize: 13 }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
