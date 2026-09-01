import { fetchWithAuth } from "./api";

// GET /admin/invoices, and the confirmation that creates coins.
//
// Shapes copied from gig-app-api's admin.controller.ts. Keep them in step.

export type InvoiceStatus = "unpaid" | "paid" | "cancelled";
export type InvoiceFilter = InvoiceStatus | "all";

export interface AdminInvoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  coins: number;
  amountCents: number;
  /** Signed, short-lived, and null when the object has gone. */
  pdfUrl: string | null;
  /** The employer's own receipt for the transfer. EVIDENCE, NOT A DECISION —
   *  a row carrying one is still unpaid, and the thing that settles an invoice
   *  is a bank statement. A screenshot is the easiest artefact here to fake. */
  paymentProofUrl: string | null;
  paymentProofAt: string | null;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  companyId: string;
  companyName: string;
  companyUen: string | null;
}

export interface InvoiceQueueResponse {
  invoices: AdminInvoice[];
  unpaidCount: number;
  /** Summed over unpaid rows only: money expected but not arrived. */
  outstandingCents: number;
  /** The subset staff can act on right now — unpaid, and the company has said
   *  they transferred. The rest of the pile is waiting on the employer. */
  awaitingConfirmationCount: number;
}

export function listInvoices(status: InvoiceFilter = "unpaid") {
  return fetchWithAuth<InvoiceQueueResponse>(`/admin/invoices?status=${status}`);
}

/** `paid` mints the coins — one transaction that stamps the invoice, writes a
 *  `topup` ledger entry and increments the company's balance. There is no way
 *  back: un-paying would mean taking back coins already spent on a shift
 *  somebody is working. `cancelled` credits nothing. */
export function decideInvoice(id: string, status: "paid" | "cancelled") {
  return fetchWithAuth<InvoiceQueueResponse>(`/admin/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
