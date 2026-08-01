import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";

const app = new Hono();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      process.env.FRONTEND_URL ?? "http://localhost:5173",
      "http://localhost:5173",
    ],
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
app.on(["GET", "POST"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get("/api/v1/ping", (c) => c.json({ message: "pong" }));

// ─── Start Server ─────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000);
console.log(`🚀 EasyTAX API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
