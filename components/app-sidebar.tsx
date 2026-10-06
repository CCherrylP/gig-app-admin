"use client";

import * as React from "react";

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
import { useAdminCounts } from "@/hooks/use-admin-counts";
import { getCachedUser } from "@/lib/auth";
import { REVIEW_TABS, REVIEW_URLS, reviewTotal } from "@/components/dashboard/review-tabs";
import { INBOX_TABS, MONEY_TABS, PEOPLE_TABS, urlsOf } from "@/components/dashboard/section-tabs";

// Grouped by what staff need to do — and the groups are OPEN, listing every
// page inside them.
//
// They were seven collapsed buckets, which is how this got hard to navigate.
// "To review" and "People" and "Money" are honest names for the groups and tell
// you nothing about where anything IS: seven queues lived behind one of those
// labels, reachable only by clicking it and then finding a tab bar. The one
// badge on the parent made it worse, not better — it said work existed and not
// which of the seven had it, so finding anything meant opening the bucket and
// reading the tabs.
//
// So every destination is listed, and every queue carries ITS OWN count. The
// parent keeps a total for when the group is folded away or the rail is in icon
// mode. Nothing moved; it is the same pages, visible.
//
// The tab bars inside each section stay. Somebody already on Certificates
// should be able to step sideways to Appeals without going back to the rail,
// and the sidebar is for finding a place rather than for working within one.
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user] = React.useState(getCachedUser);

  // Every badge in one request, asked again on a timer so a queue that fills
  // while somebody is working elsewhere says so. See useAdminCounts.
  const { data: counts } = useAdminCounts();

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
      // Still lands on the first queue with something in it when the GROUP is
      // clicked — but the children below mean nobody has to click it blind.
      url: firstWaiting,
      match: REVIEW_URLS,
      icon: <HugeiconsIcon icon={CheckmarkBadge01Icon} strokeWidth={2} />,
      badge: reviewTotal(counts),
      // ONLY THE QUEUES WITH SOMETHING IN THEM.
      //
      // This group is a worklist, and an empty queue is not work — seven
      // children where four are zero makes somebody read seven lines to find
      // the three that matter. Listing only the live ones turns the group into
      // the answer to "what is waiting", which is the question it is asked.
      //
      // Nothing becomes unreachable. The tab bar at the top of the section
      // still carries all seven, so an empty queue is one click away whenever
      // somebody wants its history rather than its backlog — and the group
      // header itself still opens the section.
      //
      // While the counts are still loading they are all undefined, so this
      // shows the full list rather than flashing an empty group and then
      // filling in; a nav that rearranges itself a second after it draws is
      // worse than one that starts complete and narrows.
      children: REVIEW_TABS.filter(
        (tab) => counts === undefined || (counts[tab.count] ?? 0) > 0,
      ).map((tab) => ({
        title: tab.label,
        url: tab.url,
        badge: counts?.[tab.count],
      })),
    },
    {
      title: "Inbox",
      url: INBOX_TABS[0].url,
      match: urlsOf(INBOX_TABS),
      icon: <HugeiconsIcon icon={InboxIcon} strokeWidth={2} />,
      // Open threads only. Answered ones are waiting on the other person.
      badge: counts?.support,
      children: INBOX_TABS.map((tab) => ({ title: tab.label, url: tab.url })),
    },
    {
      title: "People",
      url: PEOPLE_TABS[0].url,
      match: urlsOf(PEOPLE_TABS),
      icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
      children: PEOPLE_TABS.map((tab) => ({
        title: tab.label,
        url: tab.url,
        match: tab.match,
      })),
    },
    {
      title: "Shifts",
      url: "/dashboard/shifts",
      icon: <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />,
    },
    {
      title: "Money",
      url: MONEY_TABS[0].url,
      match: urlsOf(MONEY_TABS),
      icon: <HugeiconsIcon icon={ChartLineData01Icon} strokeWidth={2} />,
      children: MONEY_TABS.map((tab) => ({
        title: tab.label,
        url: tab.url,
        match: tab.match,
      })),
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
