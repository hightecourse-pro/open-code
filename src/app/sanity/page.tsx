import { redirect } from "next/navigation";

/** /sanity itself is nobody's screen: the studio is the entrance for the team, the tablets and the hall have their own addresses. */
export default function SanityIndex() {
  redirect("/sanity/studio");
}
