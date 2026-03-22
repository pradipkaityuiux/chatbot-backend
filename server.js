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

app.use(express.json({ limit: "2mb" }));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-secret"],
}));

// Handle preflight requests
app.options("*", cors());

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many messages. Please slow down." },
});

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many ingest requests." },
});

app.use("/api/chat", chatLimiter, chatRoute);
app.use("/api/ingest", ingestLimiter, ingestRoute);
app.use("/api/config", configRoute);
app.use("/api/admin", adminRoute);
app.use("/api/leads", leadsRoute);
app.use("/api/portal", portalRoute);

app.use("/portal", express.static(__dirname + "/portal"));
app.use("/widget", express.static(__dirname + "/widget"));
app.use("/admin", express.static(__dirname + "/admin"));

app.get("/", (req, res) => {
  res.json({ message: "Chatbot backend is running.", admin: "/admin", health: "/health" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});