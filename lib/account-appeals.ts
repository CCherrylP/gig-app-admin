import { fetchWithAuth } from "./api";

// GET /admin/account-appeals and the decision that empties it.
//
// Shapes copied from gig-app-api's appeals controller — the two repos share no
// package. Keep them in step.
//
// THE SECOND QUEUE, AND A DIFFERENT QUESTION. lib/appeals.ts is one SHIFT:
// somebody dropped a confirmed booking late, or was marked a no-show, and is
// arguing that one incident with a document that either covers its date or does
// not. This is the ACCOUNT: they are blocked from booking at all, and are asking
// to be let back. There is no single date to check a certificate against —
// what is being weighed is the pattern and what they say has changed.
//
// It also has NO DEADLINE, which is why it exists at all. An incident appeal
// closes three days after the shift; a block with no end date needs a way back
// that does not expire, or missing one window means never working again.

export type AccountAppealOutcome = "pending" | "waived" | "upheld";
export type AccountAppealFilter = AccountAppealOutcome | "all";

export interface AccountAppealDocument {
  kind: string;
  /** Short-lived signed link, or null when the object has gone. */
  url: string | null;
}

/** One incident standing against them, for context on the decision. */
export interface AccountAppealIncident {
  applicationId: string;
  /** 'withdrawn' or 'no_show'. */
  kind: string;
  reason: string;
  strikeNumber: number | null;
  /** Null WITH a strike means a block with no end date. */
  penaltyDays: number | null;
  /** Set when an appeal against this one incident already lifted it. */
  liftedAt: string | null;
  appealOutcome: AccountAppealOutcome | null;
  gigTitle: string | null;
  roleName: string | null;
  /** 'YYYY-MM-DD'. */
  shiftOnDate: string | null;
  at: string;
}

export interface AccountAppealReview {
  id: string;
  candidateId: string;
  candidateName: string | null;
  candidateVerified: boolean;

  /** Why they are blocked, and since when — the server's own words. */
  suspendedAt: string | null;
  suspensionReason: string | null;
  bookingBlockedUntil: string | null;

  /** Incidents applied and not waived. The same count the escalation used, so a
   *  reviewer sees the number the rule saw. */
  strikes: number;
  shiftsDone: number;

  ground: string;
  note: string | null;
  documents: AccountAppealDocument[];
  outcome: AccountAppealOutcome;
  submittedAt: string;
  reviewedAt: string | null;

  incidents: AccountAppealIncident[];
}

export interface AccountAppealsResponse {
  appeals: AccountAppealReview[];
  pendingCount: number;
}

export function listAccountAppeals(outcome: AccountAppealFilter = "pending") {
  return fetchWithAuth<AccountAppealsResponse>(
    `/admin/account-appeals?outcome=${outcome}`,
  );
}

export function decideAccountAppeal(
  id: string,
  outcome: "waived" | "upheld",
) {
  return fetchWithAuth<AccountAppealsResponse>(`/admin/account-appeals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ outcome }),
  });
}

/** What a block actually is, in the words a reviewer needs.
 *
 *  Three states and they are not degrees of one thing: a timed block runs out by
 *  itself, a suspension waits for a person, and neither is the same as an
 *  account that is simply clear. Somebody reading this queue is deciding whether
 *  to hand work back, and "blocked" alone does not say whether doing nothing
 *  would have the same effect in a week. */
export function blockState(appeal: AccountAppealReview): {
  label: string;
  detail: string;
} {
  if (appeal.suspendedAt) {
    return {
      label: "Suspended",
      detail: appeal.suspensionReason ?? "No end date — waiting on a decision",
    };
  }

  if (
    appeal.bookingBlockedUntil &&
    new Date(appeal.bookingBlockedUntil) > new Date()
  ) {
    return {
      label: "Blocked",
      detail: "A timed block that ends on its own",
    };
  }

  // Worth showing rather than hiding: the block may have expired, or another
  // decision may have lifted it while this request sat in the queue. A reviewer
  // who knows that is deciding about a record rather than about access.
  return { label: "Not blocked", detail: "The block has already been lifted" };
}

// THE GROUNDS ARE THE SAME FOUR, and that is the API's doing rather than a
// shortcut here: `accountAppealBody` is `ground: z.enum(APPEAL_GROUNDS)`, the
// identical list an incident appeal uses. So the catalogue is imported from
// lib/appeals rather than forked — two copies of one list is one that drifts,
// and the labels ("Illness", "Family emergency") are true of both.
//
// WHAT DIFFERS IS WHAT THE DOCUMENT HAS TO SHOW, and it is worth saying on the
// screen rather than in the catalogue. An incident appeal is checked against ONE
// DATE — does this MC cover the shift that was dropped. There is no single date
// here, so the same certificate is being read as evidence about a PERIOD that
// several incidents fall in. Same word, different question.
//
// A document is also optional on this queue, where an incident appeal requires
// one: the request may honestly be "I understand what happened and it will not
// happen again", which has nothing to attach.
export { APPEAL_GROUNDS, groundLabel } from "./appeals";
