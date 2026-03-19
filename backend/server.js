const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./src/config/db");

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const workoutRoutes = require("./src/routes/workoutRoutes");
const trackingRoutes = require("./src/routes/trackingRoutes");

dotenv.config();

const app = express();

/*
────────────────────────────────────────
 TRUST PROXY (Required for Railway / Cloud)
────────────────────────────────────────
*/
app.set("trust proxy", 1);

/*
────────────────────────────────────────
 SECURITY MIDDLEWARE
────────────────────────────────────────
*/
app.use(helmet());

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

/*
────────────────────────────────────────
 BODY PARSER
────────────────────────────────────────
*/
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/*
────────────────────────────────────────
 RATE LIMITER
────────────────────────────────────────
*/
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

/*
────────────────────────────────────────
 HEALTH CHECK (Railway uses this)
────────────────────────────────────────
*/
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

/*
────────────────────────────────────────
 API ROUTES
────────────────────────────────────────
*/
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/track", trackingRoutes);
app.use("/api/health", require("./src/modules/health/health.routes"));
app.use("/api/nutrition", require("./src/modules/nutrition/nutrition.routes"));

/*
────────────────────────────────────────
 ROOT ROUTE
────────────────────────────────────────
*/
app.get("/", (req, res) => {
  res.send("🚀 FitLip API running");
});

/*
────────────────────────────────────────
 404 HANDLER
────────────────────────────────────────
*/
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

/*
────────────────────────────────────────
 GLOBAL ERROR HANDLER
────────────────────────────────────────
*/
app.use((err, req, res, next) => {
  console.error("❌ API Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

/*
────────────────────────────────────────
 SERVER START
────────────────────────────────────────
*/
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {

    await connectDB();

    // start background jobs
    const scheduleWeeklyJob = require("./src/jobs/scheduleWeekly");
    await scheduleWeeklyJob();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

/*
────────────────────────────────────────
 HANDLE UNCAUGHT ERRORS
────────────────────────────────────────
*/
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED PROMISE:", err);
});