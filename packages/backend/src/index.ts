import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { triageRouter } from "./routes/triage.js";
import { enhancedTriageRouter } from "./routes/triage-enhanced.js";
import { intakeRouter } from "./routes/intake.js";
import { initSchema } from "./db/schema.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

// Routes
app.use("/api", healthRouter);
app.use("/api", triageRouter);
app.use("/api", enhancedTriageRouter);
app.use("/api", intakeRouter);

// Start server — schema migration runs in background, server starts regardless
app.listen(PORT, () => {
  console.log(`[backend] Astrata Health API running on port ${PORT}`);
});

initSchema().catch((err) => {
  console.error("[backend] Schema migration failed:", err.message);
  console.error("[backend] Database features unavailable — running with in-memory fallback");
});
