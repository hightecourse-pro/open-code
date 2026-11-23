import { TOKEN_RE } from "@/lib/sanity/shared";

export const dynamic = "force-dynamic";

/**
 * The tablet as an installed app: Chrome's ״הוספה למסך הבית״ reads this
 * manifest and opens the circle's address full screen, landscape, with no
 * browser bar - like a game, not a web page. One manifest per token, so every
 * tablet's icon opens its own circle.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return new Response("not found", { status: 404 });
  const url = `/sanity/t/${token}`;
  const manifest = {
    id: url,
    name: "המסע לאי השפיות",
    short_name: "אי השפיות",
    lang: "he",
    dir: "rtl",
    start_url: url,
    scope: url,
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "landscape",
    background_color: "#0B1530",
    theme_color: "#0B1530",
    icons: [
      { src: "/sanity/logo.png", sizes: "600x600", type: "image/png", purpose: "any" },
      { src: "/sanity/logo.png", sizes: "600x600", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
