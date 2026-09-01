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
