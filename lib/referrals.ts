import { fetchWithAuth } from "./api";

// Referral staff, referrals and commissions. Types copied from the API's
// src/contract/referral.ts.

export type ReferralKind =
  | "client"
  | "staff_candidate"
  | "candidate"
  | "employer_candidate"
  | "employer_client";
export type StaffTeam = "bd" | "ta";

/** GET /admin/referrals/partners. A company whose employers can refer, for coins. */
export interface ReferralPartner {
  companyId: string;
  name: string;
  uen: string;
  employers: number;
  referrals: number;
  /** Coins earned by all its employers. */
  coins: number;
}

/** GET /admin/referrals/staff */
export interface ReferralStaff {
  userId: string;
  name: string | null;
  email: string | null;
  team: StaffTeam;
  code: string;
  referrals: number;
  activeReferrals: number;
  pendingCents: number;
  paidCents: number;
}

/** PUT /admin/referrals/staff. `team: null` removes someone from staff. */
export interface SetReferralStaffBody {
  email: string;
  team: StaffTeam | null;
}

/** GET /admin/referrals */
export interface AdminReferral {
  id: string;
  kind: ReferralKind;
  referrer: { id: string; name: string | null; code: string | null; team: StaffTeam | null };
  /** The company for `client`, the candidate otherwise. */
  referred: { id: string; name: string | null; type: "company" | "candidate" };
  startedAt: string;
  endsAt: string;
  active: boolean;
  /** Set by an admin rather than a code at sign-up. */
  manual: boolean;
  shifts: number;
  earnedCents: number;
}

/** POST /admin/referrals. Replaces any existing referrer. */
export interface CreateReferralBody {
  code: string;
  /** Exactly one of these. */
  companyUen?: string;
  candidateEmail?: string;
}

export interface AdminCommission {
  id: string;
  kind: ReferralKind;
  referrer: { id: string; name: string | null; team: StaffTeam | null };
  referredName: string | null;
  roleName: string;
  companyName: string;
  /** YYYY-MM-DD, the shift date. */
  shiftDate: string;
  feeCents: number;
  ratePct: number;
  amountCents: number;
  /** Coins credited, for an employer referral. Null when paid in money. */
  coins: number | null;
  createdAt: string;
  paidAt: string | null;
}

export interface CommissionReferrerLine {
  referrerId: string;
  name: string | null;
  team: StaffTeam | null;
  shifts: number;
  amountCents: number;
  pendingCents: number;
}

/** GET /admin/referrals/commissions */
export interface AdminCommissionReport {
  month: string;
  rows: AdminCommission[];
  /** One line per referrer, for payroll. Cash only: coin rewards are left out. */
  byReferrer: CommissionReferrerLine[];
}

export type CommissionStatus = "pending" | "paid" | "all";

export const KIND_LABEL: Record<ReferralKind, string> = {
  client: "BD client",
  staff_candidate: "TA candidate",
  candidate: "Candidate",
  employer_candidate: "Partner → candidate",
  employer_client: "Partner → company",
};

export const TEAM_LABEL: Record<StaffTeam, string> = {
  bd: "BD",
  ta: "TA",
};

export function listReferralStaff() {
  return fetchWithAuth<ReferralStaff[]>("/admin/referrals/staff");
}

export function setReferralStaff(body: SetReferralStaffBody) {
  return fetchWithAuth<unknown>("/admin/referrals/staff", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function listReferralPartners() {
  return fetchWithAuth<ReferralPartner[]>("/admin/referrals/partners");
}

/** Turns referrals on or off for a company, by UEN. */
export function setReferralPartner(uen: string, canRefer: boolean) {
  return fetchWithAuth<unknown>("/admin/referrals/partners", {
    method: "PUT",
    body: JSON.stringify({ uen, canRefer }),
  });
}

export function listReferrals() {
  return fetchWithAuth<AdminReferral[]>("/admin/referrals");
}

export function createReferral(body: CreateReferralBody) {
  return fetchWithAuth<unknown>("/admin/referrals", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteReferral(id: string) {
  return fetchWithAuth<unknown>(`/admin/referrals/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listCommissions(month: string, status: CommissionStatus) {
  const params = new URLSearchParams({ month, status });
  return fetchWithAuth<AdminCommissionReport>(
    `/admin/referrals/commissions?${params}`,
  );
}

export function markCommissionsPaid(ids: string[]) {
  return fetchWithAuth<unknown>("/admin/referrals/commissions/paid", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/** Payroll summary as CSV. Amounts are plain dollars so a spreadsheet can sum them. */
export function byReferrerCsv(lines: CommissionReferrerLine[]) {
  const header = ["Referrer", "Team", "Shifts", "Total (SGD)", "Unpaid (SGD)"];
  const rows = lines.map((line) => [
    line.name ?? "",
    line.team ? TEAM_LABEL[line.team] : "Candidate",
    String(line.shifts),
    (line.amountCents / 100).toFixed(2),
    (line.pendingCents / 100).toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Quoted, with a leading quote on text that Excel would run as a formula. */
function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) && Number.isNaN(Number(value)) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
