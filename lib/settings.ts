import { fetchWithAuth } from "./api";

// The coin numbers — GET and PATCH /admin/settings.
//
// Three settings, and the reason there are only three is that they are the only
// decisions on this platform that are not about one row. Whether a certificate
// is real is a decision about that certificate; it does not belong in a
// configuration screen.

export interface PlatformSettings {
  /** What one coin costs, in cents. 100 is one coin to one dollar. */
  coinPriceCents: number;
  /** Coins charged per hour of every shift created, flat. */
  placementCoinsPerHour: number;
  /** Days an invoiced top-up has to be settled in. */
  invoiceTermsDays: number;
  updatedAt: string;
  updatedById: string | null;
}

export type PlatformSettingsPatch = Partial<
  Pick<
    PlatformSettings,
    "coinPriceCents" | "placementCoinsPerHour" | "invoiceTermsDays"
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
  coinPriceCents: { min: 50, max: 200 },
  placementCoinsPerHour: { min: 0, max: 50 },
  invoiceTermsDays: { min: 1, max: 90 },
} as const;
