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

/** Why the account check failed. The distinction is not pedantry — it is the
 *  difference between "your account may not do this" and "the server is not
 *  answering", and a screen that says the first when the second is true sends
 *  somebody looking for a permissions problem that does not exist.
 *
 *  That is not hypothetical: this file used to throw one error for everything,
 *  so an API pointed at a dead cloudflare tunnel produced "You are not
 *  authorised to access this dashboard" on a perfectly good admin account. */
export type AuthFailure =
  /** Reached the API; it says this account is not staff. */
  | "not-staff"
  /** The token was refused. The session is over rather than the account wrong. */
  | "session"
  /** No answer at all — API down, wrong NEXT_PUBLIC_API_URL, no network. */
  | "unreachable"
  /** Reached it and it broke. Their problem, not the reviewer's. */
  | "server";

export class AuthCheckError extends Error {
  constructor(readonly reason: AuthFailure) {
    super(reason);
    this.name = "AuthCheckError";
  }
}

/** Ask the API who this token belongs to.
 *
 *  Throws an AuthCheckError carrying WHICH of the four things went wrong, so
 *  the caller can say something true. */
export async function fetchMe(token: string): Promise<Me> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // fetch only rejects when the request never got an answer: DNS failure, a
    // refused connection, CORS. Never a 4xx or 5xx — those resolve normally.
    throw new AuthCheckError("unreachable");
  }

  if (res.status === 401) throw new AuthCheckError("session");
  // 403 from /profile means authenticated but refused. Not the admin gate —
  // /profile has none — so it is the API declining the account itself.
  if (res.status === 403) throw new AuthCheckError("not-staff");
  if (!res.ok) throw new AuthCheckError("server");

  let me: Me;
  try {
    me = (await res.json()) as Me;
  } catch {
    // A 200 that is not JSON is a proxy or a tunnel error page, not the API.
    throw new AuthCheckError("unreachable");
  }

  // The actual gate, and the only one of the four that is about permissions.
  if (me.role !== "admin") throw new AuthCheckError("not-staff");

  return me;
}

/** What to put in front of the person. Deliberately says what to DO about it,
 *  because three of the four are not the reviewer's fault. */
export function authFailureMessage(error: unknown): string {
  const reason =
    error instanceof AuthCheckError ? error.reason : ("server" as AuthFailure);

  switch (reason) {
    case "not-staff":
      return "You are not authorised to access this dashboard";
    case "session":
      return "Your session has expired. Sign in again.";
    case "unreachable":
      return "Cannot reach the server. Check that gig-app-api is running and that NEXT_PUBLIC_API_URL points at it.";
    default:
      return "The server could not answer just now. Try again in a moment.";
  }
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
