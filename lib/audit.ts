import { fetchWithAuth } from "./api";

// Who on staff opened an NRIC, a bank number or a photo. Read only.
// Shapes copied from gig-app-api's features/admin/audit.controller.ts. Keep them in step.

export interface AuditEntry {
  id: string;
  /** e.g. `identity.document`, `payouts.list`, `employer.approve`. */
  action: string;
  adminUserId: string;
  adminName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  /** Anything else that names the target, e.g. an application id or `front`. */
  targetId: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  /** Set when the table is not there yet. */
  note: string | null;
}

export function listAudit(page = 1, limit = 50) {
  return fetchWithAuth<AuditResponse>(`/admin/audit?page=${page}&limit=${limit}`);
}

const ACTION_LABELS: Record<string, string> = {
  "identity.list": "Viewed ID queue",
  "identity.document": "Opened ID photo",
  "identity.card": "Read NRIC details",
  "identity.approve": "Approved ID",
  "identity.reject": "Rejected ID",
  "payouts.list": "Viewed payout accounts",
  "payouts.proof": "Opened payout proof",
  "payroll.report": "Viewed payroll",
  "payroll.workbook": "Downloaded payroll sheet",
  "payroll.bank_export": "Exported bank file",
  "attendance.photo": "Opened attendance photo",
  "candidate.delete": "Deleted candidate",
  "employer.approve": "Approved employer",
  "employer.reject": "Rejected employer",
  "admin.create": "Added admin",
  "admin.remove": "Removed admin",
};

/** A plain label for an action code, or the code itself if it is new. */
export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
