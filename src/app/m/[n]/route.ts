import { NextResponse } from "next/server";
import { tokenForCircle } from "@/lib/sanity/server";
import { tabletPath } from "@/lib/sanity/shared";

export const dynamic = "force-dynamic";

/*
  /m/7 → the tablet of circle 7 of the active event (the owner, 26.11: ״כל ה-URLs צריכים להיות יותר פשוטים עם מספר
  לכל מעגל כי לא בכל טאבלט QR״). Short enough to type into Chrome on a tablet without a scanner; the browser lands on
  the circle's token address, which stays the circle's identity (the installed app, the refresh, a replacement device).
  An unknown number lands on the tablet's own ״הכתובת הזאת לא שייכת לאף מעגל״ screen.
*/
export async function GET(req: Request, ctx: { params: Promise<{ n: string }> }) {
  const { n } = await ctx.params;
  const circle = /^\d{1,3}$/.test(n) ? Number(n) : NaN;
  const token = Number.isFinite(circle) ? await tokenForCircle(circle) : null;
  const here = new URL(req.url);
  const to = new URL(tabletPath(token ?? "000000000000"), here.origin);
  if (here.searchParams.get("edit") === "1") to.searchParams.set("edit", "1");
  return NextResponse.redirect(to, 302);
}
