import { supabase } from "./supabase";

// Who is signed in, and whether they are allowed in here at all.
//
// The role is NOT read from the JWT. It lives on our own users row, so an admin
// who has been demoted loses access on their next request rather than their next
// sign-in — the API enforces that, and this file asks the API rather than
// guessing from a token that could be twenty minutes stale.

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/** What GET /profile answers with, trimmed to what this dashboard reads. */
export interface Me {
  id: string;
  email: string | null;
  name: string | null;
  role: "candidate" | "employer" | "admin";
  avatar: string | null;
}

/** The current access token, refreshed by the Supabase client if it has
 *  expired. Null when there is no session. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Ask the API who this token belongs to. Throws when the session is gone or
 *  the account is not staff — callers decide what to do about it. */
export async function fetchMe(token: string): Promise<Me> {
  const res = await fetch(`${API_BASE}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Could not read the signed-in account");

  const me = (await res.json()) as Me;

  if (me.role !== "admin") throw new Error("Not staff");

  return me;
}

const USER_KEY = "adhoc_admin_user";

/** Cached for the sidebar, so the name and email are on screen before the
 *  first request comes back. The gate is the API's, never this. */
export function cacheUser(me: Me) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(me));
  } catch {
    // storage unavailable (private mode) — the sidebar just renders a fallback
  }
}

export function getCachedUser(): { name: string; email: string; avatar: string } {
  const empty = { name: "Admin", email: "", avatar: "" };
  if (typeof window === "undefined") return { name: "", email: "", avatar: "" };
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return empty;
    const me = JSON.parse(raw) as Partial<Me>;
    return {
      name: me.name || "Admin",
      email: me.email ?? "",
      avatar: me.avatar ?? "",
    };
  } catch {
    return empty;
  }
}

/** End the session everywhere: Supabase's stored tokens and our cached copy of
 *  the user. Safe to call when there is no session. */
export async function signOut() {
  await supabase.auth.signOut().catch(() => {});
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}
