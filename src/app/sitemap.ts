import type { MetadataRoute } from "next";
import { isProductionEnv } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";
import { PROJECTS, SHOWCASE_PATH } from "@/lib/hackathon-showcase";

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
    // the employers' portal of the hackathon projects (1/11) - the list and every project
    { url: `${site}${SHOWCASE_PATH}`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...PROJECTS.map((p) => ({ url: `${site}${SHOWCASE_PATH}/${p.k8}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${site}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site}/masters-course`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
