import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

// Routes
app.use("/api", healthRouter);

app.listen(PORT, () => {
  console.log(`[backend] Astrata Health API running on port ${PORT}`);
});
