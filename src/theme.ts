"use client";

import { createTheme } from "@mui/material/styles";

// Centralized MUI theme. Dark by default — diagrams look better on dark canvas.
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7c5cff", // soft purple — distinct from chat-app blues
    },
    secondary: {
      main: "#34d399", // emerald accent for success states
    },
    background: {
      default: "#0f1115",
      paper: "#161a22",
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 40, textTransform: "none" },
      },
    },
  },
});

export default theme;
