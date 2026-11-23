import { photoObject } from "@/lib/sanity/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The forest photo of one circle, streamed through our own domain (Netfree
 * blocks the storage host). `?v=<photoAt>` makes a fresh photo a fresh URL.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; circle: string }> }) {
  const { slug, circle } = await params;
  const obj = await photoObject(slug, Math.round(Number(circle)));
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(obj.bytes, { headers: { "content-type": obj.contentType, "cache-control": "private, max-age=300", "x-robots-tag": "noindex" } });
}
