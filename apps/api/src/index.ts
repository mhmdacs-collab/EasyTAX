import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { syncRouter } from "./routes/sync";

const app = new Hono();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use("*", logger());
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map(s => s.trim()).filter(Boolean);
if (!allowedOrigins.includes("http://localhost:5173")) allowedOrigins.push("http://localhost:5173");

app.use(
  "*",
  cors({
    origin: allowedOrigins,
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
app.route("/api/v1/sync", syncRouter);

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
