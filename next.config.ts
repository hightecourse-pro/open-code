import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // The route used to live at /admin/cvs — but Vercel's build ignores
        // legacy CVS version-control directories by name, so the deployed
        // build silently dropped the folder (worked locally, 404 in prod).
        // The screen now lives at /admin/cv-files; keep old links working.
        source: "/admin/cvs",
        destination: "/admin/cv-files",
        permanent: true,
      },
    ];
  },
  experimental: {
    // Allow CV / PDF uploads through Server Actions (default is 1MB, which made
    // larger files fail hard). Matches the 10MB app-level cap, with headroom.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
