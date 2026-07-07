"use client";

import { Box, Typography, Alert, CircularProgress } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useDiagramStore } from "@/store/diagram-store";
import { renderMermaid } from "@/lib/mermaid";

/**
 * Renders the current Mermaid code into SVG on the client. Re-renders whenever
 * the code changes. Captures parse/render errors and surfaces them in the UI
 * AND in the store (so the chat agent can use them as retry context).
 *
 * After a successful render, the latest SVG is stashed on `window` so the
 * export menu can use it for PNG/SVG download.
 */
export default function DiagramViewer() {
  const code = useDiagramStore((s) => s.code);
  const setRenderError = useDiagramStore((s) => s.setRenderError);
  const settings = useDiagramStore((s) => s.settings);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    if (code.trim().length === 0) {
      setSvg("");
      setError(null);
      setRenderError(null);
      setLoading(false);
      return;
    }

    renderMermaid(code, settings)
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.svg) {
          setSvg(result.svg);
          setError(null);
          setRenderError(null);
          (window as unknown as { __vox2dLastSvg__?: string }).__vox2dLastSvg__ =
            result.svg;
        } else {
          setSvg("");
          setError(result.error ?? "Unknown render error");
          setRenderError(result.error ?? "Unknown render error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code, settings, setRenderError]);

  if (code.trim().length === 0) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 4,
        }}
      >
        <Typography variant="body1" color="text.secondary" align="center">
          Describe a diagram in the chat below to get started.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        p: 2,
        gap: 1,
      }}
    >
      {loading && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            rendering…
          </Typography>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ flex: "0 0 auto" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Mermaid render error
          </Typography>
          <Typography
            variant="caption"
            component="pre"
            sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}
          >
            {error}
          </Typography>
        </Alert>
      )}
      {svg && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& svg": { maxWidth: "100%", height: "auto" },
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </Box>
  );
}
