import type { MetadataRoute } from "next";
import { isProductionEnv } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";

/**
 * Search engines (the owner, 22/9: "שזה ייראה בחיפוש גוגל עם תתי נושאים").
 * Production: the public pages are crawlable, everything behind a login is
 * not. Staging and previews: nothing is indexed - the test data must never
 * show up in a search.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionEnv()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/portal", "/coordinator", "/auth", "/dev", "/forum", "/jobs", "/profile", "/chat", "/cv", "/ai", "/courses", "/members", "/subscription", "/recordings", "/events", "/articles", "/hackathon", "/mentor", "/requests", "/feed", "/content", "/attachments", "/session-feedback"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
