"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { CountBadge, CountDot } from "@/components/dashboard/count-badge";
import { cn } from "@/lib/utils";

export interface NavItem {
  title: string;
  url: string;
  icon?: React.ReactNode;
  badge?: number;
  /** Other pages that should also highlight this item. */
  match?: string[];
  // When present, the item renders as a collapsible group of sub-links instead
  // of a single link.
  children?: {
    title: string;
    url: string;
    /** Other pages that should also highlight this child — a sub-page, a tab. */
    match?: string[];
    /** Work waiting on THIS page. Carried per child so the group can be open
     *  and still say which queue the number belongs to: a count on the parent
     *  alone tells somebody there is work and not where it is, which is most of
     *  the reason the collapsed sidebar was hard to navigate. */
    badge?: number;
  }[];
}

export function NavMain({
  items,
  label,
}: {
  items: NavItem[];
  label?: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) =>
          item.children && item.children.length > 0 ? (
            <NavCollapsible key={item.title} item={item} pathname={pathname} />
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={<Link href={item.url} />}
                isActive={pathname === item.url || Boolean(item.match?.includes(pathname))}
                tooltip={
                  // The COUNT IS IN THE TOOLTIP as well, because the tooltip is
                  // the only label a collapsed rail has: the dot beside the icon
                  // says there is something, and hovering is where "four
                  // employers to verify" can actually be read.
                  item.badge && item.badge > 0
                    ? `${item.title} — ${item.badge} waiting`
                    : item.title
                }
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>

              {/* TWO RENDERINGS OF ONE NUMBER, and which shows depends on the
                  rail. SidebarMenuBadge carries `group-data-[collapsible=icon]:
                  hidden` from the kit — sensible, since a pill at the right edge
                  of a 48px rail has nowhere to be — so a collapsed sidebar used
                  to show nothing at all. That was the whole bug: staff who work
                  with the rail collapsed had no pending indicator anywhere. */}
              {item.badge != null && item.badge > 0 && (
                <>
                  <SidebarMenuBadge className="bg-transparent p-0">
                    <CountBadge count={item.badge} />
                  </SidebarMenuBadge>

                  <CountDot
                    count={item.badge}
                    className="absolute -top-0.5 right-0 hidden ring-sidebar group-data-[collapsible=icon]:inline-flex"
                  />
                </>
              )}
            </SidebarMenuItem>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavCollapsible({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const children = item.children ?? [];
  const childActive = children.some(
    (c) => pathname === c.url || (c.match?.some((u) => pathname.startsWith(u)) ?? false),
  );
  // OPEN BY DEFAULT, not closed-until-you-are-already-inside.
  //
  // A group that starts shut only helps somebody who already knows what is in
  // it, which is exactly the person who did not need the sidebar. Everybody
  // else gets a label like "Money" and has to open it to find out whether
  // Payroll lives there. Folding one away is still a click for anybody who
  // wants the space back.
  const [open, setOpen] = React.useState(true);
  const [prevChildActive, setPrevChildActive] = React.useState(childActive);

  // Auto-expand when navigating to one of the children (e.g. via a direct link).
  // Adjusted during render rather than in an effect to avoid a cascading render.
  if (childActive !== prevChildActive) {
    setPrevChildActive(childActive);
    if (childActive) setOpen(true);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={childActive}
              tooltip={
                item.badge && item.badge > 0
                  ? `${item.title} — ${item.badge} waiting`
                  : item.title
              }
            >
              {item.icon}
              <span>{item.title}</span>
              {/* The badge sits INSIDE the trigger here, unlike the plain menu
                  item above where it is a SidebarMenuBadge sibling. A collapsible
                  row already owns its right-hand edge for the chevron, and a
                  positioned badge would land underneath it.
                  `ml-auto` moves to the badge so the chevron stays last. */}
              <CountBadge count={item.badge} className="ml-auto" />
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200",
                  // Only claims the gap when no badge has already taken it.
                  item.badge != null && item.badge > 0 ? "ml-1.5" : "ml-auto",
                  open && "rotate-90",
                )}
              />
            </SidebarMenuButton>
          }
        />

        {/* The collapsed rail again: the pill inside the trigger is clipped to
            nothing at 48px wide, so the dot takes over. Same rule as the plain
            item above. */}
        <CountDot
          count={item.badge}
          className="absolute -top-0.5 right-0 hidden ring-sidebar group-data-[collapsible=icon]:inline-flex"
        />

        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <SidebarMenuSubItem key={child.title}>
                <SidebarMenuSubButton
                  render={<Link href={child.url} />}
                  isActive={
                    pathname === child.url ||
                    (child.match?.some((url) => pathname.startsWith(url)) ??
                      false)
                  }
                >
                  <span className="flex-1 truncate">{child.title}</span>
                  {child.badge != null && child.badge > 0 && (
                    <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">
                      {child.badge}
                    </span>
                  )}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
