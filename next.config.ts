import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Move the dev-only indicator badge out of the way of the chat input area.
  // Disappears automatically in production builds.
  devIndicators: {
    position: "top-left",
  },
  // Standalone output for the Docker image: Next.js copies only the necessary
  // files (no node_modules in the final image) and produces a `server.js`
  // entrypoint.
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },
};

export default nextConfig;
