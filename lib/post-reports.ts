import { fetchWithAuth } from "./api";

// Reported feed posts. These types mirror PostReportReviewDTO and
// PostReportsResponse in the API's contract/admin.ts. Keep them in step.
//
// Named post-reports because lib/reports.ts is the money reports.

export type PostReportReason = "spam" | "inappropriate" | "harassment" | "false_info" | "other";

export type PostReportFilter = "open" | "reviewed" | "all";

export const REASON_LABELS: Record<PostReportReason, string> = {
  spam: "Spam or scam",
  inappropriate: "Inappropriate",
  harassment: "Harassment",
  false_info: "False information",
  other: "Something else",
};

export interface PostReportEntry {
  id: string;
  reason: PostReportReason;
  note: string | null;
  reporterName: string;
  reportedAt: string;
  reviewedAt: string | null;
}

export interface ReportedPost {
  postId: string;
  caption: string | null;
  /** Signed links that expire after ten minutes. */
  photoUrls: string[];
  visibility: "public" | "friends";
  postedAt: string;
  /** Set once enough reports hid it from the feed. */
  hiddenAt: string | null;
  author: { id: string; name: string; avatar: string | null };
  reportCount: number;
  openCount: number;
  reasons: { reason: PostReportReason; count: number }[];
  reports: PostReportEntry[];
  lastReportedAt: string;
}

export interface PostReportsResponse {
  posts: ReportedPost[];
  openCount: number;
}

export function listPostReports(status: PostReportFilter = "open") {
  return fetchWithAuth<PostReportsResponse>(`/admin/post-reports?status=${status}`);
}

/** keep: the post is fine and shows again. remove: delete it and tell the author. */
export function decidePostReport(postId: string, action: "keep" | "remove") {
  return fetchWithAuth<PostReportsResponse>(`/admin/post-reports/${postId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

// --- reported comments (mirrors CommentReportReviewDTO) ---------------------------

export interface ReportedComment {
  commentId: string;
  body: string;
  postedAt: string;
  hiddenAt: string | null;
  author: { id: string; name: string; avatar: string | null };
  /** The post it was left on, for context. */
  post: { id: string; caption: string | null; authorName: string };
  reportCount: number;
  openCount: number;
  reasons: { reason: PostReportReason; count: number }[];
  reports: PostReportEntry[];
  lastReportedAt: string;
}

export interface CommentReportsResponse {
  comments: ReportedComment[];
  openCount: number;
}

export function listCommentReports(status: PostReportFilter = "open") {
  return fetchWithAuth<CommentReportsResponse>(`/admin/comment-reports?status=${status}`);
}

export function decideCommentReport(commentId: string, action: "keep" | "remove") {
  return fetchWithAuth<CommentReportsResponse>(`/admin/comment-reports/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}
