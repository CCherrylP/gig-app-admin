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
  ReceiptIcon,
} from "@hugeicons/core-free-icons";
import Logo from "./common/Logo";
import { listCertificates } from "@/lib/certificates";
import { listAppeals } from "@/lib/appeals";
import { listEmployers } from "@/lib/employers";
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
  const { data: invoices } = useQuery({
    queryKey: ["invoices", "unpaid"],
    queryFn: () => listInvoices("unpaid"),
  });

  const nav = [
    {
      title: "Overview",
      url: "/dashboard",
      icon: <HugeiconsIcon icon={HomeIcon} strokeWidth={2} />,
    },
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
      // No badge. This is a directory rather than a queue — nobody is waiting
      // on staff to work through it, and a count of every candidate on the
      // platform would read as a pile of work that does not exist.
      title: "All Candidates",
      url: "/dashboard/candidates",
      icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
    },
    {
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
        <NavMain items={nav} label="Admin Portal" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
