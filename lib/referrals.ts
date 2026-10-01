import { fetchWithAuth } from "./api";
import { coins, money } from "./format";

// Referral staff, referrals and commissions. Types copied from the API's
// src/contract/referral.ts. Only candidate accounts refer; rewards are coins
// (1 coin = 1 cent) that an admin cashes out.

export type ReferralKind =
  | "client"
  | "staff_candidate"
  | "candidate"
  /** Old: employers can no longer refer. */
  | "employer_candidate"
  | "employer_client";
export type StaffTeam = "bd" | "ta";

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
  /** Coins earned. Null only on rows from an older API. */
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
  /** One line per referrer, in cash. */
  byReferrer: CommissionReferrerLine[];
}

export type CommissionStatus = "pending" | "paid" | "all";

export const KIND_LABEL: Record<ReferralKind, string> = {
  client: "Business",
  staff_candidate: "Worker (TA)",
  candidate: "Worker",
  employer_candidate: "Employer (old)",
  employer_client: "Employer (old)",
};

/** A reward as coins and what they cash out to, e.g. "800 coins · $8.00". */
export function rewardLabel(row: { coins: number | null; amountCents: number }) {
  // 1 coin = 1 cent, so an older row without coins still has a count.
  const count = row.coins ?? row.amountCents;
  return `${coins(count)} coin${count === 1 ? "" : "s"} · ${money(row.amountCents)}`;
}

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
