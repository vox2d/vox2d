"use client";

import { Box } from "@mui/material";
import DiagramPanel from "@/components/diagram/diagram-panel";
import ChatPanel from "@/components/chat/chat-panel";
import TopBar from "@/components/top-bar";

/**
 * Main shell: a fixed top bar, the diagram area on top, the chat area at the
 * bottom — ChatGPT-style. Both areas share the same Zustand store.
 */
export default function HomePage() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <TopBar />
      <Box
        sx={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ flex: "1 1 60%", minHeight: 0, borderBottom: 1, borderColor: "divider" }}>
          <DiagramPanel />
        </Box>
        <Box sx={{ flex: "1 1 40%", minHeight: 0 }}>
          <ChatPanel />
        </Box>
      </Box>
    </Box>
  );
}
