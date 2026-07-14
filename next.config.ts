import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow CV / PDF uploads through Server Actions (default is 1MB, which made
    // larger files fail hard). Matches the 10MB app-level cap, with headroom.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
