"use client";

import { type AdminCounts } from "@/lib/counts";
import { SectionTabs } from "@/components/dashboard/section-tabs";

/** Everything that is waiting on staff, in one place. Each tab is its own page;
 *  this bar ties them together and shows how many are waiting on each. */
export const REVIEW_TABS: { label: string; url: string; count: keyof AdminCounts }[] = [
  { label: "Employers", url: "/dashboard/employers", count: "employers" },
  { label: "Certificates", url: "/dashboard/certificates", count: "certificates" },
  { label: "Clock-ins", url: "/dashboard/attendance", count: "attendance" },
  { label: "Appeals", url: "/dashboard/appeals", count: "appeals" },
  { label: "Payments", url: "/dashboard/payments", count: "invoices" },
  { label: "PayNow checks", url: "/dashboard/payroll/payouts", count: "payouts" },
  { label: "Reported posts", url: "/dashboard/post-reports", count: "postReports" },
];

export const REVIEW_URLS = REVIEW_TABS.map((tab) => tab.url);

/** How many things are waiting across every review tab. */
export const reviewTotal = (counts?: AdminCounts) =>
  REVIEW_TABS.reduce((sum, tab) => sum + (counts?.[tab.count] ?? 0), 0);

export function ReviewTabs() {
  // The counts are NAMED rather than resolved here — SectionTabs reads them off
  // the same polled request the sidebar and the header bell use, so every one of
  // these bars stays in step with the badge above it without each one fetching.
  return (
    <SectionTabs
      title="To review"
      tabs={REVIEW_TABS.map((tab) => ({
        label: tab.label,
        url: tab.url,
        countKey: tab.count,
      }))}
    />
  );
}
