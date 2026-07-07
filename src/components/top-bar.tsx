"use client";

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useDiagramStore } from "@/store/diagram-store";
import SettingsDialog from "@/components/settings-dialog";
import ExportMenu from "@/components/export-menu";
import { useState } from "react";

/**
 * Top app bar: app name, undo/redo, settings, export, and "new diagram".
 */
export default function TopBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const historyIndex = useDiagramStore((s) => s.historyIndex);
  const historyLen = useDiagramStore((s) => s.history.length);
  const resetAll = useDiagramStore((s) => s.resetAll);
  const code = useDiagramStore((s) => s.code);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLen - 1;

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, letterSpacing: 0.5, mr: 2 }}
        >
          vox<span style={{ color: "#7c5cff" }}>2</span>d
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton size="small" onClick={undo} disabled={!canUndo}>
              <HistoryIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <span>
            <IconButton
              size="small"
              onClick={redo}
              disabled={!canRedo}
              sx={{ transform: "scaleX(-1)" }}
            >
              <HistoryIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <ExportMenu />
        <Button size="small" onClick={() => setSettingsOpen(true)}>
          Settings
        </Button>
        <Tooltip title="New diagram (clears state)">
          <span>
            <IconButton
              size="small"
              onClick={() => {
                if (window.confirm("Start a new diagram? Current state will be cleared.")) {
                  resetAll();
                }
              }}
              disabled={code.length === 0}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Toolbar>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppBar>
  );
}
