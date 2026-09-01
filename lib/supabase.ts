import { createClient } from "@supabase/supabase-js";

// Supabase is the identity provider and nothing else.
//
// gig-app-api reads a Bearer JWT and checks the `admin` role off its own users
// row — see middleware/authenticate.ts — so this dashboard never talks to a
// table directly. It signs in, holds the session, and hands the access token to
// lib/api.ts. That is the same arrangement the Expo client uses, which is why
// there is no admin login endpoint on the API to call instead.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabase = createClient(url, key, {
  auth: {
    // The session lives in localStorage and refreshes itself, so a reload does
    // not sign the reviewer out mid-queue.
    persistSession: true,
    autoRefreshToken: true,
    // Nothing here arrives back from a redirect — there is no OAuth flow, no
    // magic link. Leaving this on makes the client parse every URL it sees.
    detectSessionInUrl: false,
  },
});
