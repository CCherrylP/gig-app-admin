import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Providers from "@/providers/QueryClientProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AuthGuard>
        <SidebarProvider>
          <AppSidebar />
          {/* min-w-0 is load-bearing. SidebarInset is a flex child, and a flex
              child's min-width defaults to `auto` — meaning "as wide as my
              content". A wide table therefore pushes the whole pane past the
              viewport instead of scrolling inside its own card, and the page's
              overflow-x-hidden then clips the last column rather than letting
              anybody reach it. */}
          <SidebarInset className="min-w-0">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-auto"
              />
            </header>
            <main className="flex flex-1 flex-col overflow-x-hidden">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </AuthGuard>
    </Providers>
  );
}
