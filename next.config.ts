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
  },
};

export default nextConfig;
