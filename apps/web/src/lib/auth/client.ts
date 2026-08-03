import { createAuthClient } from "better-auth/react";

const resolveApiUrl = (): string => {
  const value: unknown = Reflect.get(import.meta.env, "VITE_API_URL");
  return typeof value === "string" && value.length > 0 ? value : "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: resolveApiUrl(),
  // The API lives on a different domain (Render) than the frontend (Vercel),
  // so cross-site cookies must be explicitly included on every request.
  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
