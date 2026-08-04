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
  // The database tables use snake_case column names (Postgres convention),
  // while Better Auth's default schema expects camelCase. Map every
  // non-id field explicitly so reads/writes hit the correct columns.
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  trustedOrigins: [
    process.env.FRONTEND_URL ?? "http://localhost:5173",
    "http://localhost:5173",
    "https://easy-tax-web.vercel.app",
    // Vercel generates a new hash-based preview subdomain on every deploy
    // (e.g. easy-tax-<hash>-mhmdacs-collabs-projects.vercel.app). Better Auth
    // supports wildcard origin patterns, so trust any preview URL under our
    // Vercel team/project scope in addition to the explicit FRONTEND_URL.
    "https://easy-tax-*-mhmdacs-collabs-projects.vercel.app",
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL ?? "http://localhost:3000",
  session: {
    expiresIn: 60 * 60 * 24 * 30,   // 30 days
    updateAge: 60 * 60 * 24,         // refresh every 24 h
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      userId: "user_id",
    },
  },
  // The Vercel frontend and Render API live on different top-level domains,
  // so session cookies are cross-site. Browsers only send/accept cross-site
  // cookies when they're SameSite=None and Secure.
  advanced: {
    useSecureCookies: true,
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
})
