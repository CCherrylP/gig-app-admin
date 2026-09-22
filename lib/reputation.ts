import { fetchWithAuth } from "./api";

// Blocks and ratings — both read-only.
//
// Neither is a queue: nothing here waits on staff. They exist because the
// pattern across rows is what no other screen can show. One employer blocking
// one candidate is their own business; twelve companies blocking the same person
// is a fact about that person. An average rating is a number with no working
// shown; this is the working.
//
// Shapes copied from gig-app-api's contract/admin.ts. Keep them in step.

export type BlockFilter = "all" | "active" | "lifted";

export interface BlockedCandidate {
  candidateId: string;
  candidateName: string | null;
  companyId: string;
  companyName: string;
  companyUen: string;
  /** From the employer's own short list — BLOCK_REASONS in the app. */
  reason: string;
  /** The employer's private note. Never shown to the candidate. */
  note: string | null;
  blockedAt: string;
  /** Null while the block stands. Lifted rows are kept so "did we let them back
   *  in, and when" is answerable. */
  liftedAt: string | null;
  /** How many DIFFERENT companies currently block this person, platform-wide.
   *  The number this screen exists to surface. */
  activeBlocksForCandidate: number;
}

export interface BlocksResponse {
  blocks: BlockedCandidate[];
  activeCount: number;
  /** Distinct people blocked somewhere — not the same as activeCount. */
  blockedCandidateCount: number;
}

export function listBlocks(status: BlockFilter = "all") {
  return fetchWithAuth<BlocksResponse>(`/admin/blocks?status=${status}`);
}

export type RatingAbout = "all" | "candidates" | "companies";

export interface Rating {
  id: string;
  /** `system` is the penalty mark the sweep writes — a NEGATIVE rating, points
   *  deducted rather than a star score, excluded from every average. */
  by: "candidate" | "employer" | "system";
  /** Who it is ABOUT, the opposite of `by`. */
  about: "candidate" | "company";
  rating: number;
  body: string | null;
  /** `rejected` is kept rather than deleted — an employer who turns down every
   *  unflattering word would otherwise look like one with good service. */
  status: "pending" | "published" | "rejected";

  candidateId: string;
  candidateName: string | null;
  companyId: string | null;
  companyName: string | null;
  roleName: string | null;
  shiftOnDate: string | null;

  createdAt: string;
  decidedAt: string | null;
  editedAt: string | null;
}

export interface RatingsResponse {
  ratings: Rating[];
  pendingCount: number;
}

export function listRatings(about: RatingAbout = "all") {
  return fetchWithAuth<RatingsResponse>(`/admin/ratings?about=${about}`);
}

/** Stars for a real review, signed points for a system penalty.
 *
 *  They are different numbers wearing the same column, and printing "-1.0" as a
 *  star score would read as a rating below the floor the pickers can even
 *  produce. */
export const ratingText = (row: Rating) =>
  row.by === "system"
    ? `${row.rating > 0 ? "+" : ""}${row.rating.toFixed(1)} pts`
    : `${row.rating.toFixed(1)} ★`;
