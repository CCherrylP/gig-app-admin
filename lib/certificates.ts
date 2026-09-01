import { fetchWithAuth } from "./api";

// GET /admin/certificates and the decision that empties it.
//
// The shapes are gig-app-api's contract/admin.ts, copied rather than imported —
// the two repos do not share a package. Keep them in step.

export type CertStatus = "pending" | "verified" | "rejected";
export type CertFilter = CertStatus | "all";

export interface CertificateReview {
  candidateId: string;
  candidateName: string | null;
  /** Whether Singpass has confirmed the PERSON. A different question from this
   *  document, and the one that catches a licence in somebody else's name. */
  candidateVerified: boolean;
  certId: string;
  status: CertStatus;
  /** A short-lived signed link — the bucket is private and these are identity
   *  documents. It expires in minutes, so never store it: re-fetch the queue. */
  fileUrl: string | null;
  /** 'YYYY-MM-DD', or null for a kind that does not lapse. */
  expiresAt: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

export interface CertificateReviewsResponse {
  reviews: CertificateReview[];
  /** Always the count of PENDING, whatever the list is filtered to — so the
   *  badge does not read 0 while staff are looking at the verified tab. */
  pendingCount: number;
}

export function listCertificates(status: CertFilter = "pending") {
  return fetchWithAuth<CertificateReviewsResponse>(
    `/admin/certificates?status=${status}`,
  );
}

/** The decision. Addressed by the pair that identifies the row, because one
 *  certificate per person per certId is the schema's primary key.
 *
 *  `pending` is not an option: it is the absence of a decision, and re-uploading
 *  is what returns a certificate to it — the candidate's move, not staff's. */
export function reviewCertificate(
  candidateId: string,
  certId: string,
  status: "verified" | "rejected",
) {
  return fetchWithAuth<CertificateReviewsResponse>(
    `/admin/certificates/${candidateId}/${encodeURIComponent(certId)}`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
}
