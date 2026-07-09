import { createBrowserClient } from "@supabase/ssr";

let client = null;

export function createClient() {
  if (client) return client;

  // During SSG/ISR prerendering, window is undefined.
  // Return null — Supabase is only used inside useEffect/callbacks
  // which never execute during server-side rendering.
  if (typeof window === "undefined") {
    return null;
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return client;
}
