import { redirect } from "next/navigation";

// The community feed was merged into the forum. Keep the route as a redirect
// so any old links land in the right place.
export default function FeedPage() {
  redirect("/forum");
}
