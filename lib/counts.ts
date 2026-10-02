import { fetchWithAuth } from "./api";

// The sidebar's badges, and nothing else.
//
// One request for six numbers. The sidebar used to get them by running the six
// list endpoints and reading one field off each — and since it is on every page
// and none of those endpoints page, that meant six whole tables per screen.
//
// Each number mirrors the count its own queue already reports, computed from the
// same WHERE on the API side. If a badge and its list ever disagree, that is
// where the two have drifted apart.

export interface AdminCounts {
  /** Certificates uploaded and not yet checked. */
  certificates: number;
  /** Penalty appeals with no decision. */
  appeals: number;
  /** Businesses waiting on the verification call. */
  employers: number;
  /** Check-ins with something worth a human look before wages release. */
  attendance: number;
  /** Unpaid invoices where the company has said they transferred — the ones
   *  staff can act on, not the whole unpaid pile. */
  invoices: number;
  /** Open support threads, both sides together. */
  support: number;
  /** The same total split by whose question it is. The inbox is two pages worked
   *  by different staff, so a combined number on the section tells nobody which
   *  tab to open — the tabs carry these, the sidebar carries the sum.
   *
   *  Optional, like the two below, so a dashboard deployed ahead of the API
   *  shows no inbox tab counts rather than two zeroes that look like an empty
   *  queue. */
  supportCandidates?: number;
  supportEmployers?: number;
  /** PayNow proofs waiting for a check. Missing on an older API. */
  payouts?: number;
  /** Feed posts and comments with a report nobody has reviewed. Missing on an older API. */
  postReports?: number;
}

export function adminCounts() {
  return fetchWithAuth<AdminCounts>("/admin/counts");
}
