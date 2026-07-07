"use client";

import { Button, Menu, MenuItem } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useState } from "react";
import { useDiagramStore } from "@/store/diagram-store";
import {
  exportJson,
  exportMmd,
  exportPng,
  exportSvg,
  importJsonFile,
} from "@/lib/export";

/**
 * Export menu: .mmd, .json, .svg, .png, plus Import (.json).
 * PNG export depends on the latest rendered SVG, which the viewer stores on
 * `window.__vox2dLastSvg__` after each successful render.
 */
export default function ExportMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const code = useDiagramStore((s) => s.code);
  const messages = useDiagramStore((s) => s.messages);
  const settings = useDiagramStore((s) => s.settings);

  function buildSnapshot() {
    return {
      code,
      history: useDiagramStore.getState().history,
      historyIndex: useDiagramStore.getState().historyIndex,
      messages,
      settings,
    };
  }

  async function handlePng() {
    const svg = (window as unknown as { __vox2dLastSvg__?: string })
      .__vox2dLastSvg__;
    if (!svg) {
      window.alert("No rendered diagram yet — switch to Preview tab first.");
      return;
    }
    try {
      await exportPng(svg);
    } catch (err) {
      window.alert(`PNG export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleSvg() {
    const svg = (window as unknown as { __vox2dLastSvg__?: string })
      .__vox2dLastSvg__;
    if (!svg) {
      window.alert("No rendered diagram yet — switch to Preview tab first.");
      return;
    }
    exportSvg(svg);
  }

  async function handleImportJson(file: File) {
    const parsed = await importJsonFile(file);
    if (!parsed) {
      window.alert("Invalid JSON file.");
      return;
    }
    const store = useDiagramStore.getState();
    store.setCode(parsed.code);
    store.pushHistory(parsed.code);
    // Replace history, messages, settings wholesale
    useDiagramStore.setState({
      code: parsed.code,
      history: parsed.history,
      historyIndex: parsed.historyIndex,
      messages: parsed.messages,
      settings: parsed.settings,
    });
    window.alert("Imported session.");
  }

  return (
    <>
      <Button
        size="small"
        startIcon={<FileDownloadIcon fontSize="small" />}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Export
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            exportMmd(code);
            setAnchor(null);
          }}
          disabled={!code}
        >
          Mermaid code (.mmd)
        </MenuItem>
        <MenuItem
          onClick={() => {
            exportJson(buildSnapshot());
            setAnchor(null);
          }}
        >
          Full session (.json)
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleSvg();
            setAnchor(null);
          }}
        >
          Diagram as SVG
        </MenuItem>
        <MenuItem
          onClick={() => {
            handlePng();
            setAnchor(null);
          }}
        >
          Diagram as PNG
        </MenuItem>
        <MenuItem
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "application/json";
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) handleImportJson(file);
            };
            input.click();
            setAnchor(null);
          }}
        >
          Import session (.json)
        </MenuItem>
      </Menu>
    </>
  );
}
