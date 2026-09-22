import type { MetadataRoute } from "next";
import { isProductionEnv } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";

/**
 * The public face of the community - the only pages a search engine should
 * list (and the candidates Google picks sitelinks from). Empty outside
 * production so staging never advertises itself.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!isProductionEnv()) return [];
  const site = getSiteUrl();
  const now = new Date();
  return [
    { url: `${site}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/join`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site}/hackathon-2026`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/hackathon-2026/partners`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
