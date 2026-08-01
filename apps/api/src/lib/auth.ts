import { betterAuth } from "better-auth";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(process.env.DATABASE_URL);

export const auth = betterAuth({
  database: {
    // Better Auth will use this to run SQL directly
    provider: "pg",
    url: process.env.DATABASE_URL,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Enable in production
  },
  trustedOrigins: [
    process.env.FRONTEND_URL ?? "http://localhost:5173",
    "http://localhost:5173",
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL ?? "http://localhost:3000",
});
