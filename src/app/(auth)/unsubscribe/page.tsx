import type { Metadata } from "next";
import { decodeEmail, verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "הסרה מרשימת התפוצה" };
export const dynamic = "force-dynamic";

/**
 * /unsubscribe?e=<address>&t=<signature>[&leave=1] - from the foot of every
 * mail. A bad or missing signature simply means she types the address.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string; leave?: string }> }) {
  const { e, t, leave } = await searchParams;
  const email = decodeEmail(e);
  const signed = !!email && verifyUnsubscribeToken(email, t);
  return <UnsubscribeForm email={signed ? email : null} token={signed ? (t ?? null) : null} initialChoice={leave === "1" ? "leave" : "emails"} />;
}
