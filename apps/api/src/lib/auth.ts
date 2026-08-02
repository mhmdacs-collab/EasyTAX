import { betterAuth } from "better-auth"
import { Pool } from "pg"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  trustedOrigins: [
    process.env.FRONTEND_URL ?? "http://localhost:5173",
    "http://localhost:5173",
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL ?? "http://localhost:3000",
  session: {
    expiresIn: 60 * 60 * 24 * 30,   // 30 days
    updateAge: 60 * 60 * 24,         // refresh every 24 h
  },
})
