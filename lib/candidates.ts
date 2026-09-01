import { fetchWithAuth } from "./api";

// GET /admin/candidates — the support directory, and the only browsable list
// behind /admin. Read-only: nothing about a candidate is staff's to change from
// a directory, so there is no PATCH here and none on the API either.

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
}

export interface CandidatesResponse {
  candidates: CandidateSummary[];
  /** Matching the filter BEFORE the page was cut, so the screen can say it is
   *  showing fifty of two hundred. */
  total: number;
}

export const CANDIDATE_PAGE_SIZE = 50;

export function listCandidates(params: {
  q?: string;
  verified?: "verified" | "unverified" | "all";
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.verified && params.verified !== "all") {
    query.set("verified", params.verified);
  }
  query.set("limit", String(CANDIDATE_PAGE_SIZE));
  if (params.offset) query.set("offset", String(params.offset));

  return fetchWithAuth<CandidatesResponse>(`/admin/candidates?${query}`);
}

/** The app shows "No reviews" for 0 rather than a zero-star score, because
 *  nothing here can rate somebody below 1 — a new candidate printed raw reads as
 *  a terrible one. */
export const ratingLabel = (rating: number) =>
  rating > 0 ? rating.toFixed(1) : "No reviews";
