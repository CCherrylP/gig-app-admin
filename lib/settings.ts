import { fetchWithAuth } from "./api";

// The coin numbers and the hours caps — GET and PATCH /admin/settings.
//
// What everything here has in common is the only thing that qualifies a setting
// for this screen: these are the decisions on this platform that are not about
// one row. Whether a certificate is real is a decision about that certificate;
// it does not belong in a configuration screen.
//
// THE HOURS CAPS ARRIVED LATE and what was there before them was nothing.
// lib/clash in the API refuses two shifts that OVERLAP, and that was the whole
// of the protection a candidate had — six back-to-back twelve-hour shifts in six
// days overlap at no point, so all six were bookable and an 84-hour week went
// through without a single refusal.

/** One kind of work the board has roles for. Read-only, and sent with the
 *  settings because the caps form cannot offer a safe choice without it: a cap
 *  keyed on 'warehouse' when every role says 'warehouse-logistics' enforces
 *  nothing and looks exactly like one that works. */
export interface RoleTypeUsage {
  industryId: string;
  /** How many roles are filed under it — enough to tell a live vocabulary from
   *  a typo somebody posted once. */
  roles: number;
}

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

  /** HOW MUCH ONE PERSON MAY WORK, in MINUTES — one calendar day, and one week
   *  Monday to Sunday. 720 and 2640 out of the box: 12 hours and 44.
   *
   *  Minutes rather than hours for the reason money is cents: the API compares
   *  them against a shift's paid minutes, and a second unit on the wire is one
   *  more place a conversion can be forgotten. This screen shows hours.
   *
   *  ZERO MEANS NO CAP, in both, and it is the only way to say "we do not
   *  enforce this" — zero hours allowed would be a platform where nobody can
   *  work, which nobody configures on purpose. */
  maxDailyMinutes: number;
  maxWeeklyMinutes: number;

  /** WEEKLY MINUTES PER KIND OF WORK — `{ "warehouse-logistics": 1800 }`, keyed
   *  on the industry id a role carries.
   *
   *  The totals cannot say the thing that matters about demanding work: 44 hours
   *  of cashier shifts and 44 hours of warehouse picking are the same number and
   *  not the same week. Empty is no per-kind caps. */
  roleTypeCaps: Record<string, number>;

  /** The kinds of work that exist to be capped, most used first. */
  roleTypes: RoleTypeUsage[];

  updatedAt: string;
  updatedById: string | null;
}

export type PlatformSettingsPatch = Partial<
  Pick<
    PlatformSettings,
    | "coinPriceCents"
    | "placementFeeCents"
    | "invoiceTermsDays"
    | "maxDailyMinutes"
    | "maxWeeklyMinutes"
    // THE WHOLE MAP when it is sent, never a patch of it: what goes up is what
    // the platform ends up with, so removing a cap means sending the map without
    // that key. The API does not merge, deliberately — a merge would leave no
    // way to delete one.
    | "roleTypeCaps"
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
  // Minutes. Zero is allowed as "no cap" and is why the floor is not 60 —
  // between 1 and 59 is refused by the API, because a cap shorter than any real
  // shift would refuse every booking on the platform and read as an outage.
  maxDailyMinutes: { min: 0, max: 1440 },
  maxWeeklyMinutes: { min: 0, max: 10080 },
} as const;

/** The smallest cap the API will store above zero. A rule nobody could satisfy
 *  is not a rule, it is a closed platform. */
export const MIN_CAP_MINUTES = 60;

// --- hours, as this screen says them -----------------------------------------
//
// The wire is minutes and the form is hours, and these are the only two places
// that conversion happens. Fractions are real — 7.5 hours a day is an ordinary
// roster — so it is not integer division.

/** Minutes to hours for a form field: 2640 → 44, 450 → 7.5. */
export const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** Hours back to whole minutes. Rounded rather than floored: 7.49 hours typed
 *  into a box should not quietly become 449 minutes and a cap one minute tighter
 *  than what somebody read back to themselves. */
export const toMinutes = (hours: number) => Math.round(hours * 60);

/** '44h', '7h 30m', 'No limit'. The one sentence this screen and the candidate
 *  directory both need, so they cannot describe the same number differently. */
export function capLabel(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes === 0) return "No limit";

  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (whole === 0) return `${rest}m`;
  return rest === 0 ? `${whole}h` : `${whole}h ${rest}m`;
}
