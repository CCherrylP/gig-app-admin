"use client";

import { useEffect, useState, startTransition } from "react";
import {
  AuthCheckError,
  authFailureMessage,
  cacheUser,
  fetchMe,
  getAccessToken,
  signOut,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

/// Nothing behind this renders until the API has confirmed the account is staff.
///
/// The check is a request rather than a look at the JWT, because the role lives
/// on our own users row: an admin who has been removed is being removed for a
/// reason, and "some time before their token expires" is not when it should take
/// effect.
///
/// BEING UNABLE TO ASK IS NOT A NO. This used to bounce to the login screen on
/// any failure, which meant an API that was down — or a NEXT_PUBLIC_API_URL
/// pointing at a cloudflare tunnel that had since restarted — signed a perfectly
/// good admin out and told them they were not authorised. They then went looking
/// for a permissions problem that did not exist.
///
/// So only a real answer ends the session. Not being able to get one is a
/// screen that says so, and offers to try again.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authorised, setAuthorised] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function deny() {
      await signOut();
      if (!cancelled) window.location.replace("/login?r=1");
    }

    (async () => {
      const token = await getAccessToken();
      if (!token) return deny();

      try {
        const me = await fetchMe(token);
        cacheUser(me);
        if (!cancelled) startTransition(() => setAuthorised(true));
      } catch (error) {
        const reason =
          error instanceof AuthCheckError ? error.reason : "server";

        // A refusal ends the session. Anything else leaves it alone: the
        // account may well be fine, and throwing the session away over a
        // network fault costs somebody their password for nothing.
        if (reason === "not-staff" || reason === "session") return deny();

        if (!cancelled) setProblem(authFailureMessage(error));
      }
    })();

    // Signing out in another tab — or a refresh that finally fails — should
    // bounce this tab too rather than leave a queue on screen that no request
    // behind it can answer.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !cancelled) {
        window.location.replace("/login");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (problem) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="font-heading text-xl font-semibold">
            Cannot check your account
          </h1>
          <p className="text-sm text-muted-foreground">{problem}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOut();
              window.location.replace("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (!authorised) return null;
  return <>{children}</>;
}
