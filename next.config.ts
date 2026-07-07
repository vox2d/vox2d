import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output for the Docker image: Next.js copies only the necessary
  // files (no node_modules in the final image) and produces a `server.js`
  // entrypoint.
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },
};

export default nextConfig;
