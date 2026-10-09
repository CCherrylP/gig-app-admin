import { fetchWithAuth } from "./api";

// Shapes copied from gig-app-api's admin identity controller. Keep them in step.

export type IdentityFilter = "pending" | "verified" | "rejected" | "all";

export interface IdentityRecord {
  candidateId: string;
  name: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  docType: string | null;
  docLabel: string;
  /** False once decided: the NRIC photos are deleted then. Missing from older APIs. */
  hasFront?: boolean;
  /** Whether the back of the NRIC was sent. */
  hasBack: boolean;
  /** Whether a selfie was sent to match against the NRIC photo. */
  hasSelfie: boolean;
  submittedAt: string | null;
  status: "unverified" | "pending" | "verified" | "rejected";
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface IdentityResponse {
  pendingCount: number;
  records: IdentityRecord[];
}

export function listIdentity(status: IdentityFilter) {
  return fetchWithAuth<IdentityResponse>(`/admin/identity?status=${status}`);
}

export type IdentitySide = "front" | "back" | "selfie";

/** A fresh, short-lived link to one of the photos. */
export function identityDocument(candidateId: string, side: IdentitySide = "front") {
  return fetchWithAuth<{ url: string }>(`/admin/identity/${candidateId}/document?side=${side}`);
}

export function decideIdentity(candidateId: string, decision: "verified" | "rejected", note?: string) {
  return fetchWithAuth<{ ok: true }>(`/admin/identity/${candidateId}`, {
    method: "PATCH",
    body: JSON.stringify(note ? { decision, note } : { decision }),
  });
}
