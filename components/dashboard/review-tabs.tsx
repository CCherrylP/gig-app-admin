"use client";

import { useQuery } from "@tanstack/react-query";

import { adminCounts, type AdminCounts } from "@/lib/counts";
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
];

export const REVIEW_URLS = REVIEW_TABS.map((tab) => tab.url);

/** How many things are waiting across every review tab. */
export const reviewTotal = (counts?: AdminCounts) =>
  REVIEW_TABS.reduce((sum, tab) => sum + (counts?.[tab.count] ?? 0), 0);

export function ReviewTabs() {
  // Same query key as the sidebar, so this costs no extra request.
  const { data: counts } = useQuery({ queryKey: ["admin", "counts"], queryFn: adminCounts });

  return (
    <SectionTabs
      title="To review"
      tabs={REVIEW_TABS.map((tab) => ({ label: tab.label, url: tab.url, count: counts?.[tab.count] }))}
    />
  );
}
