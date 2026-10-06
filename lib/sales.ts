import { fetchWithAuth } from "./api";

// Shapes copied from gig-app-api's contract/sales.ts. Keep them in step.

export interface SalesShare {
  name: string;
  amountCents: number;
}

export interface SalesRow {
  applicationId: string;
  date: string;
  start: string;
  end: string;
  workerName: string | null;
  companyId: string;
  companyName: string;
  companyIsAgency: boolean;
  jobTitle: string;
  payPerHourCents: number;
  minutes: number;
  billCents: number;
  grossCents: number;
  /** 10% of gross when an agency referral paid on the shift, else 0. */
  accountsCents: number;
  netCents: number;
  ta: SalesShare | null;
  bd: SalesShare | null;
}

export interface SalesReport {
  month: string;
  rows: SalesRow[];
  companies: { id: string; name: string }[];
  totals: {
    minutes: number;
    billCents: number;
    grossCents: number;
    accountsCents: number;
    netCents: number;
    taCents: number;
    bdCents: number;
  };
}

/** Every signed-off shift in the month, optionally for one company. */
export function getSalesReport(month: string, company?: string | null) {
  const query = new URLSearchParams({ month });
  if (company) query.set("company", company);
  return fetchWithAuth<SalesReport>(`/admin/reports/sales?${query}`);
}
