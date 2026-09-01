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
import { cn } from "@/lib/utils";

export interface NavItem {
  title: string;
  url: string;
  icon?: React.ReactNode;
  badge?: number;
  // When present, the item renders as a collapsible group of sub-links instead
  // of a single link.
  children?: { title: string; url: string }[];
}

export function NavMain({
  items,
  label = "Admin Portal",
}: {
  items: NavItem[];
  label?: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) =>
          item.children && item.children.length > 0 ? (
            <NavCollapsible key={item.title} item={item} pathname={pathname} />
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={<Link href={item.url} />}
                isActive={pathname === item.url}
                tooltip={item.title}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.badge != null && item.badge > 0 && (
                <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
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
  const childActive = children.some((c) => pathname === c.url);
  const [open, setOpen] = React.useState(childActive);
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
            <SidebarMenuButton isActive={childActive} tooltip={item.title}>
              {item.icon}
              <span>{item.title}</span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className={cn(
                  "ml-auto size-4 shrink-0 transition-transform duration-200",
                  open && "rotate-90",
                )}
              />
            </SidebarMenuButton>
          }
        />
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <SidebarMenuSubItem key={child.title}>
                <SidebarMenuSubButton
                  render={<Link href={child.url} />}
                  isActive={pathname === child.url}
                >
                  <span>{child.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
