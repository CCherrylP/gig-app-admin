import { getAccessToken, signOut } from "./auth";

// Every call to gig-app-api goes through here.
//
// There is no refresh dance to run: the Supabase client rotates the access
// token on its own and getAccessToken() waits for it, so a 401 that survives
// this far means the session is genuinely finished rather than merely stale.

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

async function endSession(): Promise<never> {
  await signOut();
  window.location.replace("/login?r=1");
  // The redirect is not instant — throwing stops the caller rendering with a
  // half-answered request in hand.
  throw new Error("Session ended");
}

/** An API refusal, carrying the machine-readable half.
 *
 *  `message` is for the person; `code` is for the caller. A screen that has to
 *  match on wording to tell DUPLICATE_TOPUP from any other 409 breaks the moment
 *  somebody improves the sentence — so the code travels rather than being
 *  discarded and re-derived. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The API's error bodies are `{ error, code }`. Anything else — a proxy page,
 *  an empty 502 — falls back to the status line. */
async function errorFrom(res: Response) {
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    return new ApiError(
      body.error ?? `Request failed (${res.status})`,
      body.code ?? null,
      res.status,
    );
  } catch {
    return new ApiError(`Request failed (${res.status})`, null, res.status);
  }
}

export async function fetchWithAuth<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();

  if (!token) return endSession();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 401 is a dead session. 403 is an account that is not staff — including one
  // whose admin has just been taken away, which is the case the API's
  // read-the-role-off-the-row rule exists to make immediate. Both end here.
  if (res.status === 401 || res.status === 403) return endSession();

  if (!res.ok) throw await errorFrom(res);

  return (await res.json()) as T;
}
