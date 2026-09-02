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
  Coins01Icon,
  Clock01Icon,
  ReceiptIcon,
} from "@hugeicons/core-free-icons";
import Logo from "./common/Logo";
import { listCertificates } from "@/lib/certificates";
import { listAppeals } from "@/lib/appeals";
import { listEmployers } from "@/lib/employers";
import { listAttendance } from "@/lib/attendance";
import { listInvoices } from "@/lib/invoices";
import { getCachedUser } from "@/lib/auth";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user] = React.useState(getCachedUser);

  // The badges are the queues, and they run the same queries the pages do — so
  // opening one costs nothing, and working it updates the badge without a second
  // round trip.
  const { data: certs } = useQuery({
    queryKey: ["certificates", "pending"],
    queryFn: () => listCertificates("pending"),
  });
  const { data: appeals } = useQuery({
    queryKey: ["appeals", "pending"],
    queryFn: () => listAppeals("pending"),
  });
  const { data: employers } = useQuery({
    queryKey: ["employers", "pending"],
    queryFn: () => listEmployers("pending"),
  });
  const { data: attendance } = useQuery({
    queryKey: ["attendance", "attention"],
    queryFn: () => listAttendance("attention"),
  });
  const { data: invoices } = useQuery({
    queryKey: ["invoices", "unpaid"],
    queryFn: () => listInvoices("unpaid"),
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
  ];

  const candidateNav = [
    {
      title: "Certifications",
      url: "/dashboard/certificates",
      icon: <HugeiconsIcon icon={CheckmarkBadge01Icon} strokeWidth={2} />,
      badge: certs?.pendingCount,
    },
    {
      title: "Appeals",
      url: "/dashboard/appeals",
      icon: <HugeiconsIcon icon={Legal01Icon} strokeWidth={2} />,
      badge: appeals?.pendingCount,
    },
    {
      title: "Clock In / Out",
      url: "/dashboard/attendance",
      icon: <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />,
      // Two different piles of work, and the badge is their sum: selfies with
      // nobody vouching for them, plus shifts whose clock missed an end and
      // whose wages are stuck until somebody releases them. Both are somebody
      // waiting on staff, which is what a badge should count.
      badge:
        attendance === undefined
          ? undefined
          : attendance.attentionCount + attendance.missingCount,
    },
    {
      // No badge. This is a directory rather than a queue — nobody is waiting
      // on staff to work through it, and a count of every candidate on the
      // platform would read as a pile of work that does not exist.
      title: "All Candidates",
      url: "/dashboard/candidates",
      icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
    },
  ];

  const employerNav = [
    {
      title: "Employers",
      url: "/dashboard/employers",
      icon: <HugeiconsIcon icon={BuildingIcon} strokeWidth={2} />,
      badge: employers?.pendingCount,
    },
    {
      // The badge counts only the transfers a company has said it made — the
      // rest of the unpaid pile is waiting on the employer, not on staff, and
      // counting it here would show work nobody can do.
      title: "Payments",
      url: "/dashboard/payments",
      icon: <HugeiconsIcon icon={ReceiptIcon} strokeWidth={2} />,
      badge: invoices?.awaitingConfirmationCount,
    },
    {
      // Under Employers because that is who pays it: the coin price and the
      // placement fee are what a business is charged. A candidate never sees a
      // coin.
      title: "Placement Config",
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
