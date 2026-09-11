"use client";

import { SupportInbox } from "@/components/dashboard/support-inbox";

// Questions from people looking for shifts that Help & Support could not answer.
//
// The whole screen is SupportInbox — this page is the `role` it is pointed at
// and nothing else. The employer inbox next door is the same component with the
// other role: the split is which staff answer which, not a difference in the
// row, so two copies of a messaging UI would be two things to keep in step.
export default function CandidateInboxPage() {
  return (
    <SupportInbox
      role="candidate"
      title="Candidate questions"
      description="Messages from people looking for shifts — account problems, certificate rejections, pay that has not landed. Only questions the FAQ could not answer reach here."
    />
  );
}
