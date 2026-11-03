import { fetchWithAuth } from "./api";

// Sign-ins and their flags. Read only.
// Shapes copied from gig-app-api's features/admin/logins.controller.ts. Keep them in step.

export interface LoginEntry {
  id: string;
  userId: string;
  name: string | null;
  role: "candidate" | "employer" | "admin" | null;
  ip: string | null;
  /** e.g. "iPhone · Safari". Null until the API has reviewed the sign-in. */
  device: string | null;
  flags: string[];
  reviewed: boolean;
  createdAt: string;
}

export interface LoginsResponse {
  entries: LoginEntry[];
  total: number;
  /** Flagged sign-ins in the last 7 days. */
  flaggedWeek: number;
  page: number;
  limit: number;
  /** Set when the table is not there yet. */
  note: string | null;
}

export function listLogins(opts: { page?: number; limit?: number; flagged?: boolean; userId?: string }) {
  const params = new URLSearchParams({ page: String(opts.page ?? 1), limit: String(opts.limit ?? 50) });
  if (opts.flagged) params.set("flagged", "1");
  if (opts.userId) params.set("userId", opts.userId);
  return fetchWithAuth<LoginsResponse>(`/admin/logins?${params}`);
}

export const FLAG_LABELS: Record<string, { label: string; hint: string }> = {
  new_device: { label: "New device", hint: "This account has not signed in from this kind of device before." },
  many_networks: { label: "Many networks", hint: "Signed in from 3 or more networks within an hour." },
  shared_network: { label: "Shared network", hint: "5 or more accounts signed in from this network in a day." },
};

export const flagLabel = (flag: string) => FLAG_LABELS[flag]?.label ?? flag;
