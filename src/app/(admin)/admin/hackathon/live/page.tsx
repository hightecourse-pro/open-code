import { redirect } from "next/navigation";

/** The control panel moved out of the admin shell (the owner, 28/10: "מערכת הניהול צריכה להיות בדף נפרד - לא בתוך המערכת הגדולה"): /live/admin. */
export default function LiveAdminMoved() {
  redirect("/live/admin");
}
