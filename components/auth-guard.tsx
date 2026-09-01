"use client";

import { useEffect, useState, startTransition } from "react";
import { fetchMe, getAccessToken, cacheUser, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/// Nothing behind this renders until the API has confirmed the account is staff.
///
/// The check is a request rather than a look at the JWT, because the role lives
/// on our own users row: an admin who has been removed is being removed for a
/// reason, and "some time before their token expires" is not when it should take
/// effect.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authorised, setAuthorised] = useState(false);

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
      } catch {
        await deny();
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

  if (!authorised) return null;
  return <>{children}</>;
}
