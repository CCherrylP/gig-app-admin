"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { NavMain, type NavItem } from "@/components/nav-main";
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
  UserGroupIcon,
  InboxIcon,
  ChartLineData01Icon,
  Calendar03Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import Logo from "./common/Logo";
import { adminCounts } from "@/lib/counts";
import { getCachedUser } from "@/lib/auth";
import { REVIEW_TABS, REVIEW_URLS, reviewTotal } from "@/components/dashboard/review-tabs";
import { INBOX_TABS, MONEY_TABS, PEOPLE_TABS, urlsOf } from "@/components/dashboard/section-tabs";

// Seven places, grouped by what staff need to do rather than by who it is about.
// Everything waiting on staff sits under To review, with one badge for the lot.
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user] = React.useState(getCachedUser);

  // Every badge in one request. See /admin/counts.
  const { data: counts } = useQuery({
    queryKey: ["admin", "counts"],
    queryFn: adminCounts,
  });

  // Opens on the first tab with something waiting, so a click lands on work.
  const firstWaiting =
    REVIEW_TABS.find((tab) => (counts?.[tab.count] ?? 0) > 0)?.url ?? REVIEW_TABS[0].url;

  const items: NavItem[] = [
    {
      title: "Home",
      url: "/dashboard",
      icon: <HugeiconsIcon icon={HomeIcon} strokeWidth={2} />,
    },
    {
      title: "To review",
      url: firstWaiting,
      match: REVIEW_URLS,
      icon: <HugeiconsIcon icon={CheckmarkBadge01Icon} strokeWidth={2} />,
      badge: reviewTotal(counts),
    },
    {
      title: "Inbox",
      url: INBOX_TABS[0].url,
      match: urlsOf(INBOX_TABS),
      icon: <HugeiconsIcon icon={InboxIcon} strokeWidth={2} />,
      // Open threads only. Answered ones are waiting on the other person.
      badge: counts?.support,
    },
    {
      title: "Shifts",
      url: "/dashboard/shifts",
      icon: <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />,
    },
    {
      title: "People",
      url: PEOPLE_TABS[0].url,
      match: urlsOf(PEOPLE_TABS),
      icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
    },
    {
      title: "Money",
      url: MONEY_TABS[0].url,
      match: urlsOf(MONEY_TABS),
      icon: <HugeiconsIcon icon={ChartLineData01Icon} strokeWidth={2} />,
    },
    {
      title: "Settings",
      url: "/dashboard/config",
      icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
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
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
