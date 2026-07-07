"use client";

import { Box, Tabs, Tab, Paper } from "@mui/material";
import { useState } from "react";
import DiagramViewer from "@/components/diagram/diagram-viewer";
import CodeEditor from "@/components/diagram/code-editor";
import type { DiagramView } from "@/lib/types";

/**
 * The diagram area. Three tabs:
 *  - Preview: just the rendered Mermaid
 *  - Code:    just the editor
 *  - Split:   code on the left, preview on the right
 *
 * Preview is the default — the user should see their diagram immediately.
 */
export default function DiagramPanel() {
  const [view, setView] = useState<DiagramView>("preview");

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Tabs
        value={view}
        onChange={(_, v) => setView(v)}
        sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}
      >
        <Tab value="preview" label="Preview" />
        <Tab value="code" label="Code" />
        <Tab value="split" label="Split" />
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {view === "preview" && (
          <Paper
            square
            sx={{
              height: "100%",
              overflow: "auto",
              bgcolor: "background.default",
            }}
          >
            <DiagramViewer />
          </Paper>
        )}
        {view === "code" && <CodeEditor />}
        {view === "split" && (
          <Box sx={{ display: "flex", height: "100%" }}>
            <Box sx={{ flex: 1, minWidth: 0, borderRight: 1, borderColor: "divider" }}>
              <CodeEditor />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <DiagramViewer />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
