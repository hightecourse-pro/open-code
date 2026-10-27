import { NextResponse } from "next/server";
import { getProfile, isSubscriber } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The finals-tickets popup asks: is she a subscriber (the two-tickets offer)? Nothing else leaves here. */
export async function GET() {
  const profile = await getProfile().catch(() => null);
  return NextResponse.json({ subscriber: !!profile && isSubscriber(profile) }, { headers: { "cache-control": "no-store" } });
}
