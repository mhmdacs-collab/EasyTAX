import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { sql } from "./lib/db";
import { syncRouter } from "./routes/sync";
import { subscriptionRouter } from "./routes/subscription";
import { adminRouter } from "./routes/admin";
import { bootstrapRouter } from "./routes/bootstrap";

const app = new Hono();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use("*", logger());
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map(s => s.trim()).filter(Boolean);
if (!allowedOrigins.includes("http://localhost:5173")) allowedOrigins.push("http://localhost:5173");
if (!allowedOrigins.includes("https://easy-tax-web.vercel.app")) allowedOrigins.push("https://easy-tax-web.vercel.app");

// Vercel generates a new hash-based preview subdomain on every deploy
// (e.g. easy-tax-<hash>-mhmdacs-collabs-projects.vercel.app), so a static
// allowlist alone can't keep up. Allow any *.vercel.app origin that belongs
// to our Vercel team/project scope, in addition to the explicit allowlist.
const vercelPreviewPattern = /^https:\/\/easy-tax-[a-z0-9-]*mhmdacs-collabs-projects\.vercel\.app$/;

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      if (allowedOrigins.includes(origin)) return origin;
      if (vercelPreviewPattern.test(origin)) return origin;
      return undefined;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "EasyTAX API",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
});

// ─── Auth Routes (Better Auth) ────────────────────────────────────────────────
app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  const isEmailSignIn = c.req.method === "POST" && c.req.path.endsWith("/sign-in/email");
  let loginEmail: string | null = null;

  if (isEmailSignIn) {
    try {
      const body = await c.req.raw.clone().json() as { email?: unknown };
      loginEmail = typeof body.email === "string" ? body.email.toLowerCase() : null;
    } catch {
      loginEmail = null;
    }

    if (loginEmail) {
      const users = await sql`
        SELECT status, deleted_at
        FROM "user"
        WHERE LOWER(email) = ${loginEmail}
        LIMIT 1
      `;
      const user = users[0] as { status: string; deleted_at: string | null } | undefined;
      if (user && (user.status !== "active" || user.deleted_at !== null)) {
        return c.json({
          code: "ACCOUNT_DISABLED",
          message: "الحساب موقوف أو محذوف. يرجى التواصل مع الإدارة.",
        }, 403);
      }
    }
  }

  const response = await auth.handler(c.req.raw);

  if (isEmailSignIn && loginEmail && response.ok) {
    await sql`
      UPDATE "user"
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE LOWER(email) = ${loginEmail}
        AND status = 'active'
        AND deleted_at IS NULL
    `;
  }

  return response;
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get("/api/v1/ping", (c) => c.json({ message: "pong" }));
app.route("/api/v1/sync", syncRouter);
app.route("/api/v1/subscription", subscriptionRouter);
app.route("/api/v1/admin", adminRouter);
app.route("/api/v1/bootstrap", bootstrapRouter);

// ─── Start Server ─────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000);
// Force binding to 0.0.0.0 on Render (avoids localhost-only binding causing early exit)
const host = "0.0.0.0";

// If run as a standalone Node process, start an HTTP server bound to 0.0.0.0
// Otherwise export fetch for serverless adapters.
import("node:http").then(({ createServer }) => {
  // Only start if this file is executed directly (not imported by a serverless runner)
  if (process.env.DISABLE_AUTO_SERVER === "true") {
    return;
  }

  const server = createServer(async (req, res) => {
    try {
      const hostHeader = req.headers.host ?? `localhost:${port}`;
      const url = `http://${hostHeader}${req.url}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) {
          headers[k] = v.join(",");
        } else if (v != null) {
          headers[k] = String(v);
        }
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const body = chunks.length ? Buffer.concat(chunks) : undefined;

      const request = new Request(url, {
        method: req.method ?? "GET",
        headers,
        // Body may be undefined - cast to any to satisfy RequestInit typing in TS strict mode
        body: body as any,
      });

      const response = await app.fetch(request as unknown as Request);

      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const buffer = Buffer.from(await response.arrayBuffer());
      res.end(buffer);
    } catch (err) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  server.listen(port, host, () => {
    console.log(`🚀 EasyTAX API running on http://${host}:${port}`);
  });
}).catch(() => {
  // ignore - serverless environments will import the fetch export
});

export default {
  port,
  fetch: app.fetch,
};
