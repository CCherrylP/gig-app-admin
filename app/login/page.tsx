"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LoginForm } from "@/components/login-form";
import Logo from "@/components/common/Logo";

// A saved session is picked up by LoginForm, which also asks for the two-factor code.
function LoginRedirectHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("r") === "1") {
      toast.error("You must be signed in as staff to access the dashboard");
    }
  }, [searchParams]);

  return null;
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted px-6 py-10">
      <Suspense>
        <LoginRedirectHandler />
      </Suspense>
      <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl shadow-black/5 ring-1 ring-border">
        <div className="grid min-h-140 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="hidden flex-col justify-between border-r border-border bg-muted p-10 sm:p-12 lg:flex">
            <div className="space-y-8">
              <Logo />
              <div className="space-y-4">
                <p className="text-4xl font-semibold tracking-tight text-foreground">
                  Reviews that need a person.
                </p>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Sign in to review the certificates candidates upload before
                  they apply for work, and to confirm the bank transfers that
                  credit an employer&apos;s coins.
                </p>
              </div>
              <div className="grid gap-4 text-sm">
                <div className="rounded-3xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">
                    Certificate reviews
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Staff check that each licence is genuine, current and
                    belongs to the holder. Reviews are worked oldest first, so
                    no candidate waits too long to apply for shifts.
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">
                    Invoice confirmations
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    This is the only place coins are created. Staff match each
                    transfer to the bank statement before confirming it, so
                    companies cannot mark their own invoices as paid.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-background p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center justify-center lg:hidden">
                <Logo />
              </div>
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
