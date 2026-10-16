import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The syllabus is a static file in public/ (served from our own
        // domain for Netfree). Vercel's default is `inline; filename=
        // "syllabus.pdf"`, and the browser prefers that header over the
        // link's download attribute - so the Hebrew file name is set here.
        source: "/masters-course/syllabus.pdf",
        headers: [
          {
            key: "Content-Disposition",
            value: `attachment; filename="masters-syllabus.pdf"; filename*=UTF-8''${encodeURIComponent("סילבוס מאסטרית בהייטק.pdf")}`,
          },
        ],
      },
      {
        // The hackathon's free-tools guide - same treatment.
        source: "/hackathon-2026/ai-tools-guide.pdf",
        headers: [
          {
            key: "Content-Disposition",
            value: `attachment; filename="hackathon-ai-tools.pdf"; filename*=UTF-8''${encodeURIComponent("ארגז הכלים החינמי - האקתון.pdf")}`,
          },
        ],
      },
    ];
  },
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
    // Instant re-visits (the owner, 16/10): a page she already opened is
    // replayed from the client router cache for 5 minutes, and the route
    // template refreshes it in the background with a ״מתעדכן״ pill. Dynamic
    // routes are also prefetched on hover, so the first click is instant too.
    staleTimes: { dynamic: 300, static: 300 },
    dynamicOnHover: true,
  },
  env: {
    // The route snapshots in localStorage are only reused within the build
    // that wrote them (class names and markup can change between deploys).
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? `dev-${Date.now()}`,
  },
};

export default nextConfig;
