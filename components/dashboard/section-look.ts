import {
  BuildingIcon,
  Calendar03Icon,
  Camera01Icon,
  ChartLineData01Icon,
  CheckmarkBadge01Icon,
  Flag01Icon,
  InboxIcon,
  Invoice01Icon,
  Legal01Icon,
  Money03Icon,
  Settings02Icon,
  StarIcon,
  UserGroupIcon,
  UserMultipleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import type { IconType } from "@/components/dashboard/data-views";

// ONE COLOUR AND ONE ICON PER PLACE, wherever that place shows up.
//
// Home's tiles, the panels under them and each page's own header all read from
// here, so certificates are violet on the to-do grid and violet at the top of
// the certificates page. The point is that the colour becomes the label: after
// a week nobody reads "Certificates", they see violet.

export type SectionLook = { icon: IconType; tint: string };

// Every class spelled out in full: Tailwind only ships classes it can find
// written down in the source, so a `bg-${hue}-100` built at runtime would
// silently render with no colour at all.
export const LOOKS = {
  employers: { icon: BuildingIcon, tint: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  certificates: { icon: CheckmarkBadge01Icon, tint: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  attendance: { icon: Camera01Icon, tint: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  appeals: { icon: Legal01Icon, tint: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  invoices: { icon: Invoice01Icon, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  payouts: { icon: Wallet01Icon, tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  postReports: { icon: Flag01Icon, tint: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  support: { icon: InboxIcon, tint: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300" },
  candidates: { icon: UserGroupIcon, tint: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  reputation: { icon: StarIcon, tint: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  referrals: { icon: UserMultipleIcon, tint: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
  shifts: { icon: Calendar03Icon, tint: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  money: { icon: ChartLineData01Icon, tint: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300" },
  payroll: { icon: Money03Icon, tint: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  config: { icon: Settings02Icon, tint: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
} satisfies Record<string, SectionLook>;

/** Which look a page wears, by its address. Longest prefix wins, so
 *  /dashboard/payroll/payouts is PayNow checks rather than payroll. */
const BY_PATH: [string, SectionLook][] = (
  [
    ["/dashboard/people/employers", LOOKS.employers],
    ["/dashboard/employers", LOOKS.employers],
    ["/dashboard/certificates", LOOKS.certificates],
    ["/dashboard/attendance", LOOKS.attendance],
    ["/dashboard/appeals", LOOKS.appeals],
    ["/dashboard/payments", LOOKS.invoices],
    ["/dashboard/invoices", LOOKS.invoices],
    ["/dashboard/payroll/payouts", LOOKS.payouts],
    ["/dashboard/payroll", LOOKS.payroll],
    ["/dashboard/post-reports", LOOKS.postReports],
    ["/dashboard/inbox", LOOKS.support],
    ["/dashboard/candidates", LOOKS.candidates],
    ["/dashboard/reputation", LOOKS.reputation],
    ["/dashboard/referrals", LOOKS.referrals],
    ["/dashboard/shifts", LOOKS.shifts],
    ["/dashboard/money", LOOKS.money],
    ["/dashboard/config", LOOKS.config],
  ] as [string, SectionLook][]
).sort((a, b) => b[0].length - a[0].length);

export function lookForPath(pathname: string): SectionLook | null {
  return BY_PATH.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? null;
}
