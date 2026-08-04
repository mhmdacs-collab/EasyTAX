import { createAuthClient } from "better-auth/react";
import { resolveApiUrl } from "@/lib/api/baseUrl";

export const authClient = createAuthClient({
  baseURL: resolveApiUrl(),
  // Production uses the same-origin Vercel proxy so mobile browsers accept
  // the session cookie. Local development still uses VITE_API_URL.
  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
