"use client";

import { SupportInbox } from "@/components/dashboard/support-inbox";

// The hiring side of the same queue — see the note on the candidate page.
//
// Still its own page rather than one page reading the side off the URL, which is
// the point the shell here made before it was wired: the two queues are not the
// same work. An employer asking about an invoice needs the payments screen open
// beside it; a candidate asking about a rejected certificate needs the review
// queue. What they share today is the messaging UI, which is why that lives in
// SupportInbox and this file is the role it is pointed at — when the two do
// diverge, it is this page that grows, not a branch inside the component.
export default function EmployerInboxPage() {
  return (
    <SupportInbox
      role="employer"
      title="Employer questions"
      description="Messages from businesses — invoices, coin top-ups, and shifts nobody turned up for. Only questions the FAQ could not answer reach here."
    />
  );
}
