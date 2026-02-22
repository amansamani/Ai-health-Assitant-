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

require('./src/config/db'); 

// connect database
connectDB();

const scheduleWeeklyJob = require('./src/jobs/scheduleWeekly');
scheduleWeeklyJob();

const app = express();

// security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/track", trackingRoutes);
app.use("/api/health", require("./modules/health/health.routes"));
app.use("/api/nutrition", require("./modules/nutrition/nutrition.routes"));

// test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});