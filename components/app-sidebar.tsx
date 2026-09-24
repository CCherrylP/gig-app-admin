"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  HomeIcon,
  CheckmarkBadge01Icon,
  Legal01Icon,
  BuildingIcon,
  UserGroupIcon,
  StarIcon,
  Coins01Icon,
  Clock01Icon,
  ReceiptIcon,
  InboxIcon,
  MoneyBag02Icon,
  ChartLineData01Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons";
import Logo from "./common/Logo";
import { adminCounts } from "@/lib/counts";
import { getCachedUser } from "@/lib/auth";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user] = React.useState(getCachedUser);

  // SIX NUMBERS, ONE REQUEST.
  //
  // These badges used to run the six LIST endpoints and read one field off each
  // response. The sidebar is on every page, and none of those endpoints pages —
  // so every screen in this dashboard pulled six whole tables with their joins
  // to draw six integers in a nav rail, before its own data had been asked for.
  // The attendance one also signed a link to every photograph in the queue.
  //
  // /admin/counts is six indexed COUNTs run together. Nothing on the pages had
  // to change for it: a MutationCache callback in the query provider refreshes
  // this key after ANY mutation succeeds, so a decision still updates its badge
  // without every screen having to remember to say so.
  const { data: counts } = useQuery({
    queryKey: ["admin", "counts"],
    queryFn: adminCounts,
  });

  // Grouped by WHOSE SIDE the work is on, not by what kind of thing it is.
  //
  // That is the split staff actually work to: a shift over a certificate, an
  // appeal and a clock-in is one person's morning, and it has nothing to do
  // with chasing a business for a bank transfer. Sorting them by "queues" and
  // "settings" instead would put the coin price next to the certificate queue
  // and separate two screens that are about the same candidate.
  const overview = [
    {
      title: "Overview",
      url: "/dashboard",
      icon: <HugeiconsIcon icon={HomeIcon} strokeWidth={2} />,
    },
    {
      // HERE, beside Overview, for the same reason Inbox and the two reports
      // are: a shift is both sides at once. The employer posted it and the
      // candidate works it, so filing it under either would hide half of what it
      // is about.
      //
      // NO BADGE, and this is the one where it was tempting. Unfilled shifts are
      // a real number and the page shows it — but nobody on staff can fill a
      // shift, only the board can, so a badge counting them would show work that
      // cannot be done and would never reach zero.
      title: "Shifts",
      url: "/dashboard/shifts",
      icon: <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />,
    },
    {
      // Up here rather than under Candidates or Employers because it is the one
      // thing that is BOTH — filing it on one side would hide half the messages
      // from whoever is looking. The split lives inside it instead, so staff can
      // see at a glance which side a question came from before opening it.
      //
      // The parent row is a collapsible trigger, not a link, so this `url` is
      // never navigated to from here — but /dashboard/inbox exists anyway and
      // redirects to the candidate queue, for the address typed by hand.
      title: "Inbox",
      url: "/dashboard/inbox",
      icon: <HugeiconsIcon icon={InboxIcon} strokeWidth={2} />,
      // Threads still OPEN, which is the work — not the total, and not the
      // unread count. `answered` is waiting on them, and a badge counting that
      // would never reach zero.
      badge: counts?.support,
      children: [
        { title: "Candidate questions", url: "/dashboard/inbox/candidates" },
        { title: "Employer questions", url: "/dashboard/inbox/employers" },
      ],
    },
    {
      // THE TWO REPORTS SIT HERE, beside Overview, for the same reason Inbox
      // does: each spans both sides of the platform. Payroll is money owed to
      // candidates, earned on work employers booked; Money is what employers
      // paid, against fees the platform charged. Filing either under
      // Candidates or Employers would hide half of what it is about.
      //
      // NO BADGE on either. What matters is an AMOUNT rather than a number of
      // rows, and payroll's largest pile — shifts waiting on an employer's
      // sign-off — is not work staff can act on. A badge counting it would
      // never reach zero.
      //
      // PAYROLL OPENS, because it is two readings of one set of shifts and they
      // belong together rather than apart in the list. By shift is for settling
      // a row; the attendance sheet is for paying a PERSON, which is what a
      // transfer actually is — somebody who worked four shifts is one payment.
      title: "Payroll",
      url: "/dashboard/payroll",
      icon: <HugeiconsIcon icon={MoneyBag02Icon} strokeWidth={2} />,
      children: [
        { title: "By shift", url: "/dashboard/payroll" },
        { title: "Attendance sheet", url: "/dashboard/payroll/sheet" },
      ],
    },
    {
      title: "Money",
      url: "/dashboard/money",
      icon: <HugeiconsIcon icon={ChartLineData01Icon} strokeWidth={2} />,
    },
  ];

  const candidateNav = [
    {
      title: "Certifications",
      url: "/dashboard/certificates",
      icon: <HugeiconsIcon icon={CheckmarkBadge01Icon} strokeWidth={2} />,
      badge: counts?.certificates,
    },
    {
      title: "Appeals",
      url: "/dashboard/appeals",
      icon: <HugeiconsIcon icon={Legal01Icon} strokeWidth={2} />,
      badge: counts?.appeals,
    },
    {
      title: "Clock In / Out",
      url: "/dashboard/attendance",
      icon: <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />,
      // Two different piles of work, and the badge is their sum: selfies with
      // nobody vouching for them, plus shifts whose clock missed an end and
      // whose wages are stuck until somebody releases them. Both are somebody
      // waiting on staff, which is what a badge should count.
      // Summed on the API side now — see attendanceBadgeCount — so the badge
      // and the queue it points at cannot drift apart.
      badge: counts?.attendance,
    },
    {
      // No badge. This is a directory rather than a queue — nobody is waiting
      // on staff to work through it, and a count of every candidate on the
      // platform would read as a pile of work that does not exist.
      title: "All Candidates",
      url: "/dashboard/candidates",
      icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
    },
    {
      // No badge either, and for a stronger reason than the directory above: a
      // block is not work waiting on staff. It is one employer's own decision
      // about their own site, and badging a count of them would turn a record
      // into a queue nobody is meant to clear.
      title: "Reputation",
      url: "/dashboard/reputation",
      icon: <HugeiconsIcon icon={StarIcon} strokeWidth={2} />,
    },
  ];

  const employerNav = [
    {
      title: "Employers",
      url: "/dashboard/employers",
      icon: <HugeiconsIcon icon={BuildingIcon} strokeWidth={2} />,
      badge: counts?.employers,
    },
    {
      // The badge counts only the transfers a company has said it made — the
      // rest of the unpaid pile is waiting on the employer, not on staff, and
      // counting it here would show work nobody can do.
      title: "Payments",
      url: "/dashboard/payments",
      icon: <HugeiconsIcon icon={ReceiptIcon} strokeWidth={2} />,
      badge: counts?.invoices,
    },
    {
      // Under Employers because that is who pays it: the coin price and the
      // placement fee are what a business is charged. A candidate never sees a
      // coin.
      title: "Platform Config",
      url: "/dashboard/config",
      icon: <HugeiconsIcon icon={Coins01Icon} strokeWidth={2} />,
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <Logo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={overview} label="Admin Portal" />
        <NavMain items={candidateNav} label="Candidates" />
        <NavMain items={employerNav} label="Employers" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
