import { fetchWithAuth } from "./api";

// GET /admin/employers and the phone call that empties it.
//
// Shapes copied from gig-app-api's contract/admin.ts. Keep them in step.

export type EmployerStatus = "pending" | "approved" | "rejected";
export type EmployerFilter = EmployerStatus | "all";
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export interface EmployerReview {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  /** The PERSON's Singpass check — a different question from the business's. */
  personVerified: boolean;
  status: EmployerStatus;
  reviewedAt: string | null;
  createdAt: string;

  companyId: string;
  companyName: string;
  companyUen: string;
  companyIndustry: string | null;
  companyAddress: string | null;
  /** The BUSINESS's own check. Both halves gate posting, and they can disagree. */
  companyVerificationStatus: VerificationStatus;
  /** How many people already hold a seat at this UEN. */
  companySeats: number;
}

export interface EmployersResponse {
  employers: EmployerReview[];
  pendingCount: number;
}

export function listEmployers(status: EmployerFilter = "pending") {
  return fetchWithAuth<EmployersResponse>(`/admin/employers?status=${status}`);
}

/** `status` is this person's approval; `companyVerified` is the business's own.
 *  Omit the second to leave the company alone — the right thing for the second
 *  manager at a business already checked. */
export function decideEmployer(
  userId: string,
  status: "approved" | "rejected",
  companyVerified?: boolean,
) {
  return fetchWithAuth<EmployersResponse>(`/admin/employers/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(
      companyVerified === undefined ? { status } : { status, companyVerified },
    ),
  });
}

/** The correction, not the decision — see UpdateEmployerDetailsBody in the API's
 *  contract/admin.ts.
 *
 *  DESCRIPTION ONLY. Name and phone are Singpass's answer, email is Supabase's,
 *  and company name and UEN are ACRA's; none of them are editable here, and the
 *  form does not pretend otherwise. Send `null` to clear a field, omit the key
 *  to leave it alone. */
export interface EmployerDetailsPatch {
  jobTitle?: string | null;
  companyIndustry?: string | null;
  companyAddress?: string | null;
}

/** Answers with the `all` list rather than the pending queue, because the
 *  employer being corrected is very often an approved one. */
export function updateEmployerDetails(
  userId: string,
  details: EmployerDetailsPatch,
) {
  return fetchWithAuth<EmployersResponse>(
    `/admin/employers/${userId}/details`,
    { method: "PATCH", body: JSON.stringify(details) },
  );
}

/** The floor and ceiling the API enforces, mirrored so the form can say no
 *  before a round trip does. MIN_COINS matches the app's own smallest top-up:
 *  one shift costs more than a few hundred coins once wages and the hourly fee
 *  are in it, so anything less buys nothing. */
export const MIN_TOPUP_COINS = 1000;
export const MAX_TOPUP_COINS = 1_000_000;

/** The invoice a preset top-up raises. Shapes copied from gig-app-api's
 *  contract/admin.ts — keep them in step. */
export interface AdminTopUp {
  id: string;
  number: string;
  coins: number;
  amountCents: number;
  issuedAt: string;
  dueAt: string;
  /** Null when the account has no address, which is how staff know they still
   *  have to send the bill themselves. */
  emailedTo: string | null;
}

/** Raise the bill FOR a company, so the employer only has to pay it.
 *
 *  CREATES NO COINS. It is raised unpaid and stays that way until somebody
 *  confirms the transfer against a bank statement on the payments screen — the
 *  one check that keeps whoever raises a bill from also crediting it. Refused
 *  with 409 COMPANY_NOT_VERIFIED for a business nobody has confirmed exists. */
export function createTopUp(userId: string, coins: number) {
  return fetchWithAuth<AdminTopUp>(`/admin/employers/${userId}/top-up`, {
    method: "POST",
    body: JSON.stringify({ coins }),
  });
}
