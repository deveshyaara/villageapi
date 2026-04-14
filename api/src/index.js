import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

import authRoutes from "./routes/auth.js";
import searchRoutes from "./routes/search.js";
import statesRoutes from "./routes/states.js";
import districtsRoutes from "./routes/districts.js";
import subdistrictsRoutes from "./routes/subdistricts.js";
import adminRoutes from "./routes/admin.js";
import b2bRoutes from "./routes/b2b.js";
import { autocompleteHandler } from "./routes/search.js";

import authMiddleware from "./middleware/authMiddleware.js";
import rateLimiter from "./middleware/rateLimiter.js";
import errorHandler from "./middleware/errorHandler.js";
import responseFormatter from "./middleware/responseFormatter.js";
import apiLogger from "./middleware/apiLogger.js";

// ─── Startup Checks ────────────────────────────────────────────

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET"];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// ─── Express App ────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3001;

const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(
  new Set([
    ...parseOrigins(process.env.FRONTEND_URLS),
    ...parseOrigins(process.env.FRONTEND_URL),
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
  ])
);

// Global middleware
app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(responseFormatter);
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  next();
});

// ─── Health Check ───────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  });
});

// ─── Public Routes ──────────────────────────────────────────────

app.use("/api/v1/auth", authRoutes);

// ─── Protected Routes (API Key + Rate Limiting) ─────────────────

app.use("/api/v1/search", authMiddleware, rateLimiter, apiLogger, searchRoutes);
app.get("/api/v1/autocomplete", authMiddleware, rateLimiter, apiLogger, autocompleteHandler);
app.use("/api/v1/states", authMiddleware, rateLimiter, apiLogger, statesRoutes);
app.use("/api/v1/districts", authMiddleware, rateLimiter, apiLogger, districtsRoutes);
app.use("/api/v1/subdistricts", authMiddleware, rateLimiter, apiLogger, subdistrictsRoutes);

// ─── Portal Routes (JWT auth) ───────────────────────────────────

app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/b2b", b2bRoutes);

// ─── 404 Catch-All ──────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "The requested endpoint does not exist" },
  });
});

// ─── Error Handler ──────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🏘️  VillageAPI server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   API base:     http://localhost:${PORT}/api/v1\n`);
});

export default app;
