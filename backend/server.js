const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./src/config/db");
const logger = require("./src/config/logger");

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const workoutRoutes = require("./src/routes/workoutRoutes");
const trackingRoutes = require("./src/routes/trackingRoutes");

dotenv.config();

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:19006,http://localhost:8081")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/track", trackingRoutes);
app.use("/api/health", require("./src/modules/health/health.routes"));
app.use("/api/nutrition", require("./src/modules/nutrition/nutrition.routes"));
app.use("/api/admin", require("./src/routes/admin"));

app.get("/", (req, res) => {
  res.send("🚀 FitLip API running");
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  logger.error({ err }, "API Error");

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {

    await connectDB();

const scheduleWeeklyJob = require("./src/jobs/scheduleWeekly");
scheduleWeeklyJob().catch(err => logger.error({ err }, "Weekly job scheduling failed (non-fatal)"));

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on port ${PORT}`);
    });

  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
};

startServer();

process.on("uncaughtException", (err) => {
  logger.error({ err }, "UNCAUGHT EXCEPTION");
});

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "UNHANDLED PROMISE REJECTION");
});