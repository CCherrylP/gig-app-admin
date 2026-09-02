import { fetchWithAuth } from "./api";

// GET /admin/candidates — the support directory, and the only browsable list
// behind /admin.
//
// ONE thing here is writable: the suspension. That is not a directory feature
// that crept in — it is the other half of a rule the API already enforces. A
// no-show, or a third late cancellation, blocks booking with no end date
// "pending a human decision" (lib/penalty says so, and deliberately refuses to
// make it automatic). This is where that human decides.
//
// Shapes copied from gig-app-api's contract/admin.ts. Keep them in step.

export interface CandidateSummary {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean;
  area: string | null;
  /** A code from workPassData.json in the app. Null means not answered, which
   *  is not the same as not allowed. */
  workStatus: string | null;
  /** 0 means NOT RATED YET rather than rated badly — never print it raw. */
  rating: number;
  shiftsDone: number;
  lateCancels: number;
  turnUpRate: number | null;
  /** Certificates still waiting on us — the answer to "why can't I apply". */
  pendingCertificates: number;
  createdAt: string;

  // Two ways of being unable to take work, and they are not the same: a timed
  // block runs out on its own, a suspension waits for somebody to look.
  /** Suspended with no end date. This is the ban. */
  suspendedAt: string | null;
  suspensionReason: string | null;
  /** The admin who did it, or null when the SWEEP did. Null is a fact rather
   *  than a gap — it separates "a rule fired" from "a person decided". */
  suspendedById: string | null;
  /** A timed block. A date in the past means it is simply over. */
  bookingBlockedUntil: string | null;
}

export interface CandidatesResponse {
  candidates: CandidateSummary[];
  /** Matching the filter BEFORE the page was cut, so the screen can say it is
   *  showing fifty of two hundred. */
  total: number;
  /** Suspended across the whole platform, whatever this page is filtered to.
   *  The one number here that is a QUEUE: people who cannot earn until
   *  somebody looks at their account. */
  suspendedCount: number;
}

export type BookingFilter = "all" | "suspended" | "blocked" | "clear";

export const CANDIDATE_PAGE_SIZE = 50;

export function listCandidates(params: {
  q?: string;
  verified?: "verified" | "unverified" | "all";
  booking?: BookingFilter;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.verified && params.verified !== "all") {
    query.set("verified", params.verified);
  }
  if (params.booking && params.booking !== "all") {
    query.set("booking", params.booking);
  }
  query.set("limit", String(CANDIDATE_PAGE_SIZE));
  if (params.offset) query.set("offset", String(params.offset));

  return fetchWithAuth<CandidatesResponse>(`/admin/candidates?${query}`);
}

/** Suspend, or lift.
 *
 *  A suspension blocks BOOKING and nothing else — they can still sign in, read
 *  their history, appeal, and be paid for shifts already worked. A ban that
 *  stranded earned wages would be confiscating money over a rule breach, and one
 *  that closed the app would close the only route to arguing it.
 *
 *  `reason` is required when suspending and is SHOWN TO THE CANDIDATE, in the
 *  notification the API writes in the same transaction as the decision. */
export function setSuspension(
  userId: string,
  suspended: boolean,
  reason?: string,
) {
  return fetchWithAuth<CandidatesResponse>(
    `/admin/candidates/${userId}/suspension`,
    {
      method: "PATCH",
      body: JSON.stringify(suspended ? { suspended, reason } : { suspended }),
    },
  );
}

/** The app shows "No reviews" for 0 rather than a zero-star score, because
 *  nothing here can rate somebody below 1 — a new candidate printed raw reads as
 *  a terrible one. */
export const ratingLabel = (rating: number) =>
  rating > 0 ? rating.toFixed(1) : "No reviews";
