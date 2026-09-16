import { fetchWithAuth } from "./api";

// The coin numbers — GET and PATCH /admin/settings.
//
// Three settings, and the reason there are only three is that they are the only
// decisions on this platform that are not about one row. Whether a certificate
// is real is a decision about that certificate; it does not belong in a
// configuration screen.

export interface PlatformSettings {
  /** What one coin costs, in cents. 50, and the same for every company.
   *
   *  IT IS ALSO THE DIVISOR a shift's wages are converted through, so changing
   *  it changes what a coin BUYS as well as what it costs — and balances people
   *  have already paid for do not follow. See the redenomination note in the
   *  API's prisma/migrations/fixed_coin_price.sql. */
  coinPriceCents: number;
  /** The placement fee in CENTS per hour of shift, flat. 200 — two dollars.
   *
   *  MONEY, NOT COINS, and the field name matters: this used to be
   *  `placementCoinsPerHour`, which is what the API's DTO stopped calling it
   *  when the fee moved to money. The PATCH body is strict, so the old name was
   *  silently rejected and the fee could not be edited from this screen at all. */
  placementFeeCents: number;
  /** Days an invoiced top-up has to be settled in. */
  invoiceTermsDays: number;
  updatedAt: string;
  updatedById: string | null;
}

export type PlatformSettingsPatch = Partial<
  Pick<
    PlatformSettings,
    "coinPriceCents" | "placementFeeCents" | "invoiceTermsDays"
  >
>;

export function getSettings() {
  return fetchWithAuth<PlatformSettings>("/admin/settings");
}

/** Only what changed. Restating a field you did not mean to touch is how a
 *  price gets reverted by somebody editing something else — so the form sends
 *  the diff, not the whole row. */
export function updateSettings(patch: PlatformSettingsPatch) {
  return fetchWithAuth<PlatformSettings>("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// The bounds the API enforces, repeated here so the form can refuse a value
// before a round trip rather than after one. The API is the authority — these
// exist to explain the rule, not to be it.
export const BOUNDS = {
  coinPriceCents: { min: 10, max: 200 },
  placementFeeCents: { min: 0, max: 5000 },
  invoiceTermsDays: { min: 1, max: 90 },
} as const;
