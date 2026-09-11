import { redirect } from "next/navigation";

// The sidebar never links here — the Inbox row is a collapsible trigger, not a
// link. This exists for the address typed by hand, the stale bookmark, and the
// link pasted into a chat: careerhop-admin gives every collapsible parent a real
// page, and a 404 is a worse answer than the queue somebody meant.
export default function InboxPage() {
  redirect("/dashboard/inbox/candidates");
}
