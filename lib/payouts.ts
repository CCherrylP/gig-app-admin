import { fetchWithAuth } from "./api";
import type { PayoutVerification } from "./reports";

// WHERE SOMEBODY'S WAGES GO, and whether anybody has checked it is really them.
//
// A candidate types a mobile number and a name into one form, so the two agree
// with each other by construction rather than by evidence. A PayNow transfer
// clears immediately and cannot be reversed, so a mistyped digit pays a
// stranger permanently.
//
// They upload a screenshot of their own PayNow profile — the registered name
// against the registered number — and somebody here compares the two.
//
// NOTHING HERE BLOCKS A PAYMENT, deliberately. A gate would mean somebody who
// worked a shift goes unpaid because an admin has not opened a screenshot yet,
// which puts the cost of our check on the person who did the work.

export interface PayoutAccount {
  candidateId: string;
  candidateName: string | null;
  candidateEmail: string | null;
  /** The mobile on their ACCOUNT, which is not necessarily the one they gave
   *  for payment. Showing both is half the check. */
  candidatePhone: string | null;

  kind: "paynow" | "bank";
  number: string;
  bank: string | null;
  holderName: string | null;

  /** Whether there is a screenshot. The link comes from `payoutProof`. */
  hasProof: boolean;
  verification: PayoutVerification;
  verifiedAt: string | null;
  /** Why it was turned down. The candidate sees this. */
  reviewNote: string | null;
  updatedAt: string;
}

export interface PayoutsResponse {
  payouts: PayoutAccount[];
  pendingCount: number;
}

export function listPayouts(
  status: PayoutVerification | "all" = "pending",
) {
  return fetchWithAuth<PayoutsResponse>(`/admin/payouts?status=${status}`);
}

/** A fresh link to one screenshot, signed now.
 *
 *  Its own request rather than a field on the list, for the reason every private
 *  document in this dashboard works that way: a link to somebody's banking
 *  screenshot should be minted when a person opens it, not on every load of a
 *  queue whether or not anybody does. */
export function payoutProof(candidateId: string) {
  return fetchWithAuth<{ url: string }>(`/admin/payouts/${candidateId}/proof`);
}

/** Approve or refuse. A refusal needs a reason — the candidate reads it, and a
 *  no with no reason produces the same upload again. */
export function reviewPayout(
  candidateId: string,
  verification: "verified" | "rejected",
  note?: string,
) {
  return fetchWithAuth<{ payout: PayoutAccount }>(`/admin/payouts/${candidateId}`, {
    method: "PATCH",
    body: JSON.stringify({ verification, ...(note ? { note } : {}) }),
  });
}
