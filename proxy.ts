import { NextResponse, type NextRequest } from "next/server";

// A fresh CSP nonce on every page, as the Next 16 CSP guide recommends.
// Next reads the nonce from the request header and puts it on its own scripts.

/** The origin of a URL from the environment, or null when unset or invalid. */
function originOf(value: string | undefined): string | null {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

/** The policy for one response. Exported for tests. */
export function buildCsp(nonce: string, isDev: boolean): string {
  const api = originOf(process.env.NEXT_PUBLIC_API_URL);
  const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const list = (...items: (string | null | false)[]) => items.filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    `script-src ${list("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", isDev && "'unsafe-eval'")}`,
    // React style attributes and the chart and toast styles are inline.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${list("'self'", "data:", "blob:", supabase)}`,
    "font-src 'self'",
    `connect-src ${list("'self'", api, supabase, supabaseWs)}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
    .filter(Boolean)
    .join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
