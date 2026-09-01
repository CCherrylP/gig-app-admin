import { fetchWithAuth } from "./api";

// GET /admin/appeals and the decision that empties it.
//
// Shapes copied from gig-app-api's contract/admin.ts — the two repos share no
// package. Keep them in step.

export type AppealOutcome = "pending" | "waived" | "upheld";
export type AppealFilter = AppealOutcome | "all";

export interface AppealDocument {
  kind: string;
  /** Short-lived signed link, or null when the object has gone. */
  url: string | null;
}

export interface AppealReview {
  /** The withdrawal's id, which is the application's — one appeal per
   *  withdrawal is the schema's primary key. */
  withdrawalId: string;
  candidateId: string;
  candidateName: string | null;
  candidateVerified: boolean;
  /** Late cancellations already on this person. What separates a bad week from
   *  a pattern. */
  lateCancels: number;

  /** 'mc' | 'family' | 'accident' | 'other' — APPEAL_GROUNDS in the app. */
  ground: string;
  note: string | null;
  documents: AppealDocument[];
  outcome: AppealOutcome;
  submittedAt: string;
  reviewedAt: string | null;

  withdrawalReason: string;
  withdrawalNote: string | null;
  late: boolean;
  withdrawnAt: string;

  gigTitle: string | null;
  roleName: string | null;
  companyName: string | null;
  /** 'YYYY-MM-DD' — the day the shift was on, which is the date the MC has to
   *  cover. */
  shiftOnDate: string | null;
}

export interface AppealsResponse {
  appeals: AppealReview[];
  pendingCount: number;
}

export function listAppeals(outcome: AppealFilter = "pending") {
  return fetchWithAuth<AppealsResponse>(`/admin/appeals?outcome=${outcome}`);
}

export function decideAppeal(
  withdrawalId: string,
  outcome: "waived" | "upheld",
) {
  return fetchWithAuth<AppealsResponse>(`/admin/appeals/${withdrawalId}`, {
    method: "PATCH",
    body: JSON.stringify({ outcome }),
  });
}

// The grounds catalogue, mirrored from the app's data/penalty.js. Same reasoning
// as the certificate catalogue: the API sends an id, and 'mc' is not something a
// reviewer can weigh a document against — what the evidence is SUPPOSED to show
// is the thing that makes the decision possible.
export const APPEAL_GROUNDS: Record<
  string,
  { label: string; evidence: string }
> = {
  mc: {
    label: "Illness",
    evidence:
      "A medical certificate covering the date of the shift, showing the issuing clinic.",
  },
  family: {
    label: "Family emergency",
    evidence:
      "A hospital letter, a death certificate, or a police report naming the family member.",
  },
  accident: {
    label: "Accident or emergency on the day",
    evidence:
      "A police report, an insurance claim, or a hospital discharge slip.",
  },
  other: {
    label: "Something else",
    evidence:
      "Any supporting document. Outside illness and emergencies, appeals on this ground are rarely approved.",
  },
};

export const groundLabel = (id: string) =>
  APPEAL_GROUNDS[id]?.label ??
  id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
