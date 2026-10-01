import type { AdminCounts } from "@/lib/counts";
import { REVIEW_TABS } from "@/components/dashboard/review-tabs";

// EVERY PILE OF WORK ON THIS DASHBOARD, as one list.
//
// WHY IT IS HERE AND NOT WRITTEN OUT THREE TIMES. Home's to-do list, the bell in
// the header and the total on the sidebar are three renderings of one question —
// what is waiting on staff — and each used to carry its own copy of the answer.
// The failure mode of that is not a crash: it is a bell that says 4 above a
// to-do list that says 5, and from then on nobody trusts either. Adding a queue
// meant remembering three places, and forgetting one of them is invisible.
//
// THE REVIEW TABS ARE THE SPINE of it, imported rather than restated, because
// those ARE the queues — anything waiting on a person has a page under To review.
// The inbox is added on the end: it is work waiting on staff too, but it is a
// conversation rather than a decision, which is why it is its own section.

export interface WorkQueue {
  label: string;
  /** One plain line about what the pile is, for the to-do list. */
  note: string;
  url: string;
  /** Which number on /admin/counts is this queue's. */
  count: keyof AdminCounts;
  /** How an arrival reads in a sentence: "1 new employer to verify", "2 new
   *  employers to verify".
   *
   *  BOTH SPELLED OUT rather than an 's' appended to one of them. Half of these
   *  end in a prepositional phrase — "new question in the inbox" — where the
   *  plural belongs on the noun and not at the end, and a rule that appends
   *  would write "inboxs". */
  arrival: { one: string; many: string };
}

/** One plain line under each queue, keyed by the count it badges. Separate from
 *  REVIEW_TABS because that list is a row of tab labels and has no room for a
 *  sentence. */
const NOTES: Partial<
  Record<keyof AdminCounts, { note: string; arrival: { one: string; many: string } }>
> = {
  employers: {
    note: "Businesses waiting for a verification call.",
    arrival: { one: "new employer to verify", many: "new employers to verify" },
  },
  certificates: {
    note: "Certificates to check.",
    arrival: { one: "new certificate to check", many: "new certificates to check" },
  },
  attendance: {
    note: "Selfie check-ins and missed clock-outs.",
    arrival: { one: "new clock-in to look at", many: "new clock-ins to look at" },
  },
  appeals: {
    note: "Penalty appeals to decide.",
    arrival: { one: "new appeal to decide", many: "new appeals to decide" },
  },
  invoices: {
    note: "Transfers to confirm against the bank.",
    arrival: { one: "new transfer to confirm", many: "new transfers to confirm" },
  },
  payouts: {
    note: "PayNow numbers to match to a name.",
    arrival: { one: "new PayNow number to check", many: "new PayNow numbers to check" },
  },
  postReports: {
    note: "Posts somebody reported.",
    arrival: { one: "new reported post", many: "new reported posts" },
  },
  support: {
    note: "Questions from candidates and employers.",
    arrival: {
      one: "new question in the inbox",
      many: "new questions in the inbox",
    },
  },
};

const UNKNOWN = { one: "new thing to look at", many: "new things to look at" };

export const WORK_QUEUES: WorkQueue[] = [
  ...REVIEW_TABS.map((tab) => ({
    label: tab.label,
    url: tab.url,
    count: tab.count,
    note: NOTES[tab.count]?.note ?? "",
    arrival: NOTES[tab.count]?.arrival ?? UNKNOWN,
  })),
  {
    label: "Inbox",
    // ONE ROW FOR BOTH INBOXES, on `support` rather than the two split counts
    // beside it. The split exists for the inbox's own tabs; using it here as well
    // would count every question twice in the total, which is the one number on
    // this screen that has to be right.
    count: "support",
    url: "/dashboard/inbox/candidates",
    note: NOTES.support?.note ?? "",
    arrival: NOTES.support?.arrival ?? UNKNOWN,
  },
];

/** Everything waiting on staff, across every queue. */
export const workTotal = (counts?: AdminCounts) =>
  WORK_QUEUES.reduce((sum, queue) => sum + (counts?.[queue.count] ?? 0), 0);

/** The first queue with something in it, for a button that should land on work
 *  rather than on an empty page. Falls back to the to-do list itself. */
export const firstWaiting = (counts?: AdminCounts) =>
  WORK_QUEUES.find((queue) => (counts?.[queue.count] ?? 0) > 0)?.url ?? "/dashboard";

/** '2 new questions in the inbox and 1 new employer to verify' — what ARRIVED
 *  since the last time these numbers were read, as one sentence.
 *
 *  Built from the rise in each queue rather than from the totals, because the
 *  totals hide the case that matters: two certificates cleared and one employer
 *  arriving is a total that has gone DOWN, and the employer still needs
 *  answering. Only rises count; a queue somebody has just worked is not news.
 *
 *  Returns null when nothing went up, which is most of the time. */
export function arrivalSentence(
  before: AdminCounts,
  after: AdminCounts,
): string | null {
  const risen = WORK_QUEUES.map((queue) => {
    const by = (after[queue.count] ?? 0) - (before[queue.count] ?? 0);
    return { queue, by };
  }).filter((row) => row.by > 0);

  if (risen.length === 0) return null;

  const parts = risen.map(
    ({ queue, by }) => `${by} ${by === 1 ? queue.arrival.one : queue.arrival.many}`,
  );

  if (parts.length === 1) return parts[0];

  // 'a, b and c' — the last one joined with "and" rather than a comma, because
  // this is read as a sentence in a banner and not as a list.
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
