import { fetchWithAuth } from "./api";

// GET /admin/employers and the phone call that empties it.
//
// Shapes copied from gig-app-api's contract/admin.ts. Keep them in step.

export type EmployerStatus = "pending" | "approved" | "rejected";
export type EmployerFilter = EmployerStatus | "all";
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export interface EmployerReview {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  /** The PERSON's Singpass check — a different question from the business's. */
  personVerified: boolean;
  status: EmployerStatus;
  reviewedAt: string | null;
  createdAt: string;

  companyId: string;
  companyName: string;
  companyUen: string;
  companyIndustry: string | null;
  /** Where the WORK is — autofilled from ACRA at sign-up, read by candidates
   *  judging a commute. Not necessarily where a bill should go. */
  companyAddress: string | null;
  /** Where invoices are addressed. NULL MEANS "use companyAddress", which is
   *  what every invoice did before this field existed — not "nowhere to send
   *  it". Nothing collects it at sign-up, so it is null on most rows; show the
   *  fallback rather than an empty box. */
  companyBillingAddress: string | null;
  /** The BUSINESS's own check. Both halves gate posting, and they can disagree. */
  companyVerificationStatus: VerificationStatus;
  /** How many people already hold a seat at this UEN. */
  companySeats: number;
  /** `companyCoinPriceCents` is GONE, with the per-company rate behind it. One
   *  published price now, on the Config screen, the same for everybody. */
}

export interface EmployersResponse {
  employers: EmployerReview[];
  pendingCount: number;
}

export function listEmployers(status: EmployerFilter = "pending") {
  return fetchWithAuth<EmployersResponse>(`/admin/employers?status=${status}`);
}

/** `status` is this person's approval; `companyVerified` is the business's own.
 *  Omit the second to leave the company alone — the right thing for the second
 *  manager at a business already checked. */
export function decideEmployer(
  userId: string,
  status: "approved" | "rejected",
  companyVerified?: boolean,
) {
  return fetchWithAuth<EmployersResponse>(`/admin/employers/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(
      companyVerified === undefined ? { status } : { status, companyVerified },
    ),
  });
}

/** The correction, not the decision — see UpdateEmployerDetailsBody in the API's
 *  contract/admin.ts.
 *
 *  DESCRIPTION ONLY. Name and phone are Singpass's answer, email is Supabase's,
 *  and company name and UEN are ACRA's; none of them are editable here, and the
 *  form does not pretend otherwise. Send `null` to clear a field, omit the key
 *  to leave it alone. */
export interface EmployerDetailsPatch {
  jobTitle?: string | null;
  companyIndustry?: string | null;
  companyAddress?: string | null;
  /** Null (or an empty string) puts the company back on the companyAddress
   *  fallback — a real state, and not the same as copying the outlet address
   *  in: a company on the fallback follows an outlet move, one with its own
   *  billing address deliberately does not. */
  companyBillingAddress?: string | null;
}

/** Answers with the `all` list rather than the pending queue, because the
 *  employer being corrected is very often an approved one. */
export function updateEmployerDetails(
  userId: string,
  details: EmployerDetailsPatch,
) {
  return fetchWithAuth<EmployersResponse>(
    `/admin/employers/${userId}/details`,
    { method: "PATCH", body: JSON.stringify(details) },
  );
}

/** The floor and ceiling the API enforces, mirrored so the form can say no
 *  before a round trip does. MIN_COINS matches the app's own smallest top-up:
 *  one shift costs more than a few hundred coins once wages and the hourly fee
 *  are in it, so anything less buys nothing. */
export const MIN_TOPUP_COINS = 1000;
export const MAX_TOPUP_COINS = 1_000_000;

/** The round amounts offered as one tap, copied from QUICK_AMOUNTS in the app's
 *  data/coins so staff and employers are working from the same shortcuts.
 *
 *  They are the numbers people actually type, NOT products: there are no packs
 *  and no bonus coins, so 10,000 is ten times 1,000 and nothing else. A pack
 *  that paid a bonus would make the price of a shift depend on how the wallet
 *  was topped up. */
export const QUICK_TOPUP_COINS = [1000, 2000, 5000, 10000];

/** Singapore's GST, in basis points. 900 = 9%.
 *
 *  Mirrored from the API's invoice controller so the preview on the top-up form
 *  can say the total a company will actually transfer. The API is what bills;
 *  this only explains it, and the figure it prints is re-derived server-side
 *  before any bill exists. */
export const GST_BASIS_POINTS = 900;

/** The invoice a preset top-up raises. Shapes copied from gig-app-api's
 *  contract/admin.ts — keep them in step. */
export interface AdminTopUp {
  id: string;
  number: string;
  /** The QUANTITY of coins. 10,000 coins is 10,000, not a pack. */
  coins: number;
  /** Coins times the unit price, BEFORE tax. */
  amountCents: number;
  /** GST in cents. */
  gstCents: number;
  /** amountCents + gstCents — what the company actually transfers. */
  totalCents: number;
  /** What each coin was billed at. The published price, the same for everybody. */
  coinPriceCents: number;
  issuedAt: string;
  dueAt: string;
  /** Last day the coins on this bill can be spent — the issue date plus a year. */
  coinsValidUntil: string;
  /** Null when the account has no address, which is how staff know they still
   *  have to send the bill themselves. */
  emailedTo: string | null;
}

/** Raise the bill FOR a company, so the employer only has to pay it.
 *
 *  CREATES NO COINS. It is raised unpaid and stays that way until somebody
 *  confirms the transfer against a bank statement on the payments screen — the
 *  one check that keeps whoever raises a bill from also crediting it. Refused
 *  with 409 COMPANY_NOT_VERIFIED for a business nobody has confirmed exists. */
/** `setCoinPrice` is GONE. There is no per-company rate to set — the price lives
 *  on the Config screen and applies to everybody. */

/** Raise the bill for a company. The AMOUNT only — the rate is the published
 *  price. There is no per-bill override: a price with two homes is two answers
 *  to what a customer pays. */
export function createTopUp(
  userId: string,
  coins: number,
  /** Past the duplicate guard. Only ever sent after the screen has shown which
   *  unpaid bill already exists and somebody has said to raise another. */
  allowDuplicate = false,
) {
  return fetchWithAuth<AdminTopUp>(`/admin/employers/${userId}/top-up`, {
    method: "POST",
    body: JSON.stringify(
      allowDuplicate ? { coins, allowDuplicate: true } : { coins },
    ),
  });
}
