import { fetchWithAuth } from "./api";

// GET /admin/candidates — the support directory, and the only browsable list
// behind /admin.
//
// TWO things here are writable, and both are the other half of a rule the API
// enforces rather than directory features that crept in.
//
//   the suspension  a no-show, or a third late cancellation, blocks booking with
//                   no end date "pending a human decision" — lib/penalty says so
//                   and deliberately refuses to make it automatic. This is where
//                   that human decides.
//   the hours cap   the platform's own limits live on Platform config and are
//                   right for almost everybody. This is for a cap that is a FACT
//                   ABOUT ONE PERSON: a student pass allows 16 hours a week
//                   during term, and no platform-wide number can say that
//                   without capping everybody at 16.
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

  // A THIRD way a booking can be refused, and the only one that is not a
  // penalty: how much they are allowed to work.
  //
  // THREE STATES, and they are three different answers — only this screen can
  // say them in words:
  //
  //   null  follow the platform's cap. Almost every row, and the right default.
  //   0     EXEMPT. This person has no cap of that kind at all.
  //   n     their own limit, in minutes.

  maxDailyMinutes: number | null;
  maxWeeklyMinutes: number | null;
  /** Why they are capped differently. SHOWN TO THEM when a booking is refused by
   *  it — the same promise suspensionReason makes — so it is never blank while a
   *  cap is set. */
  hoursCapReason: string | null;
  /** Which admin set it, and when. Always a person: no sweep writes these, so
   *  unlike suspendedById a null means only that no cap was ever set. */
  hoursCapSetById: string | null;
  hoursCapSetAt: string | null;
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

/** This person's own hours cap, or `null, null` to put them back on the
 *  platform's.
 *
 *  BOTH NUMBERS TRAVEL TOGETHER, and null is a real instruction rather than
 *  "leave alone" — it is the only way to undo an override, so it cannot be
 *  expressed by leaving a field out.
 *
 *  `reason` is required whenever either number is set and is SHOWN TO THE
 *  CANDIDATE in the refusal the cap produces. Nobody is notified when it is set,
 *  unlike a suspension: a cap takes nothing away, so a banner announcing one
 *  would alarm without informing. */
export function setHoursCap(
  userId: string,
  cap: {
    maxDailyMinutes: number | null;
    maxWeeklyMinutes: number | null;
    reason?: string | null;
  },
) {
  return fetchWithAuth<CandidatesResponse>(`/admin/candidates/${userId}/hours`, {
    method: "PATCH",
    body: JSON.stringify(cap),
  });
}

/** Whether this person is on a cap of their own rather than the platform's. One
 *  helper so the row, the pill and the dialog cannot disagree about what counts
 *  as "capped". */
export const hasOwnCap = (candidate: CandidateSummary) =>
  candidate.maxDailyMinutes !== null || candidate.maxWeeklyMinutes !== null;

/** The app shows "No reviews" for 0 rather than a zero-star score, because
 *  nothing here can rate somebody below 1 — a new candidate printed raw reads as
 *  a terrible one. */
export const ratingLabel = (rating: number) =>
  rating > 0 ? rating.toFixed(1) : "No reviews";
