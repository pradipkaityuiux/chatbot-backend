require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const chatRoute = require("./routes/chat");
const ingestRoute = require("./routes/ingest");
const configRoute = require("./routes/config");
const adminRoute = require("./routes/admin");
const leadsRoute = require("./routes/leads");
const portalRoute = require("./routes/portal");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Define all limiters first ─────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Rate limit exceeded." },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "Too many messages. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many ingest requests." },
});

// ── Middleware ────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-secret"],
}));

app.options("*", cors());
app.use(globalLimiter);

// ── Origin check for chat ─────────────────────────────────────
app.use("/api/chat", (req, res, next) => {
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  const isLocalhost = origin.includes("localhost") || referer.includes("localhost");
  const hasOrigin = origin.length > 0;

  if (!isLocalhost && !hasOrigin) {
    return res.status(403).json({ error: "Forbidden." });
  }

  next();
});

// ── Routes ────────────────────────────────────────────────────
app.use("/api/chat", chatLimiter, chatRoute);
app.use("/api/ingest", ingestLimiter, ingestRoute);
app.use("/api/config", configRoute);
app.use("/api/admin", adminRoute);
app.use("/api/leads", leadsRoute);
app.use("/api/portal", portalRoute);

// ── Static files ──────────────────────────────────────────────
app.use("/portal", express.static(__dirname + "/portal"));
app.use("/widget", express.static(__dirname + "/widget"));
app.use("/admin", express.static(__dirname + "/admin"));

// ── Base routes ───────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "Chatbot backend is running.",
    admin: "/admin",
    health: "/health",
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Warmup + Keepalive ────────────────────────────────────────
async function warmUp() {
  try {
    const supabase = require("./lib/supabase");
    const { embed } = require("./lib/embeddings");

    await supabase.from("business_configs").select("business_id").limit(1);
    console.log("✓ Supabase warmed up.");

    await embed("warmup");
    console.log("✓ OpenAI embeddings warmed up.");

    // Start keepalive AFTER warmup completes
    setInterval(async () => {
      try {
        await embed("ping");
        console.log("[ keepalive ] embeddings warm");
      } catch (err) {
        console.log("[ keepalive ] failed:", err.message);
      }
    }, 4 * 60 * 1000);

  } catch (err) {
    console.log("Warmup error:", err.message);
  }
}

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  warmUp();
});