"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LoginForm } from "@/components/login-form";
import Logo from "@/components/common/Logo";
import { getAccessToken } from "@/lib/auth";

function LoginRedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("r") === "1") {
      toast.error("You must be signed in as staff to access the dashboard");
    }
  }, [searchParams]);

  useEffect(() => {
    // Only skip the form when Supabase still holds a session. Whether it belongs
    // to staff is the dashboard's AuthGuard to decide — it asks the API, and
    // this screen must not answer that question from a cached role.
    let cancelled = false;
    (async () => {
      if (searchParams.get("r") === "1") return;
      const token = await getAccessToken();
      if (token && !cancelled) router.replace("/dashboard");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                  The two decisions a machine cannot make.
                </p>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Sign in to read the certificates candidates upload before they
                  can apply for work, and to confirm the bank transfers that
                  credit an employer&apos;s coins.
                </p>
              </div>
              <div className="grid gap-4 text-sm">
                <div className="rounded-3xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">
                    Certificate reviews
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    A licence is a photograph of a document. Whether it is real,
                    current and the holder&apos;s own is a person reading it —
                    worked oldest first, because the longest wait is the one
                    keeping somebody from a shift.
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">
                    Invoice confirmations
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    The only place coins are created. Somebody finds the transfer
                    on a bank statement and says so — a company that could mark
                    its own invoice paid would have an unlimited float.
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
