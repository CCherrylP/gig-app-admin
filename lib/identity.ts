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
  /** The code they declared, e.g. "s_pass". Missing on an older API. */
  workStatus?: string | null;
  /** What the candidate's app read off the front and showed them, kept from the
   *  scan. Null when nothing was kept (an older app build); missing on an older
   *  API. Either way the page falls back to asking for a read. */
  card?: IdentityCard | null;
  /** What was read off the back. The address itself is never sent. */
  back?: { issued: string | null; hasAddress: boolean; missing: string[] } | null;
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

/** What the NRIC front says, compared with the profile. The candidate's own
 *  scan when it was kept, otherwise read by the API on demand. */
export interface IdentityCard {
  /** S••••567D. */
  masked: string | null;
  name: string | null;
  /** yyyy-mm-dd. */
  dob: string | null;
  sex?: "M" | "F" | null;
  cardType: "singaporean" | "pr" | null;
  /** Fields that did not read. Missing on an older API. */
  missing?: string[];
  /** null when one side is unknown. */
  nameMatches: boolean | null;
  dobMatches: boolean | null;
  cardTypeMatches: boolean | null;
}

export function identityCard(candidateId: string) {
  return fetchWithAuth<IdentityCard>(`/admin/identity/${candidateId}/card`);
}

export function decideIdentity(candidateId: string, decision: "verified" | "rejected", note?: string) {
  return fetchWithAuth<{ ok: true }>(`/admin/identity/${candidateId}`, {
    method: "PATCH",
    body: JSON.stringify(note ? { decision, note } : { decision }),
  });
}
