require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./src/config/db");
const logger = require("./src/config/logger");

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const workoutRoutes = require("./src/routes/workoutRoutes");
const trackingRoutes = require("./src/routes/trackingRoutes");

const scheduleWeeklyJob = require("./src/jobs/scheduleWeekly");
const scheduleEngagementNotifications = require("./src/jobs/scheduleEngagementNotifications");

const app = express();

app.set("trust proxy", 1);

app.disable("x-powered-by");

/*
 * ---------------------------------------------------------------------------
 * Security
 * ---------------------------------------------------------------------------
 */

app.use(
  helmet()
);

/*
 * ---------------------------------------------------------------------------
 * CORS
 * ---------------------------------------------------------------------------
 */

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:19006,http://localhost:8081"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      /*
       * Native mobile apps normally don't send an Origin header.
       *
       * Therefore requests without Origin are allowed.
       */
      if (!origin) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/*
 * ---------------------------------------------------------------------------
 * Body parsing
 * ---------------------------------------------------------------------------
 *
 * 10 MB is intentionally retained because the application has
 * image-related nutrition functionality.
 */
app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/*
 * ---------------------------------------------------------------------------
 * Global API rate limiter
 * ---------------------------------------------------------------------------
 */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 200,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many requests. Please try again later.",
  },
});

app.use(
  "/api",
  limiter
);

/*
 * ---------------------------------------------------------------------------
 * Health check
 * ---------------------------------------------------------------------------
 */

app.get(
  "/health",
  (req, res) => {
    return res.status(200).json({
      status: "OK",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
);

/*
 * ---------------------------------------------------------------------------
 * API routes
 * ---------------------------------------------------------------------------
 */

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/user",
  userRoutes
);

app.use(
  "/api/workouts",
  workoutRoutes
);

app.use(
  "/api/track",
  trackingRoutes
);

app.use(
  "/api/health",
  require(
    "./src/modules/health/health.routes"
  )
);

app.use(
  "/api/social",
  require(
    "./src/modules/social/social.routes"
  )
);

app.use(
  "/api/nutrition",
  require(
    "./src/modules/nutrition/nutrition.routes"
  )
);

app.use(
  "/api/admin",
  require(
    "./src/routes/admin"
  )
);

/*
 * ---------------------------------------------------------------------------
 * Root endpoint
 * ---------------------------------------------------------------------------
 */

app.get(
  "/",
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "FitLip API running",
    });
  }
);

/*
 * ---------------------------------------------------------------------------
 * 404
 * ---------------------------------------------------------------------------
 */

app.use(
  (req, res) => {
    return res.status(404).json({
      success: false,
      message: "Route not found",
    });
  }
);

/*
 * ---------------------------------------------------------------------------
 * Global error handler
 * ---------------------------------------------------------------------------
 */

app.use(
  (err, req, res, next) => {
    logger.error(
      {
        err,
        method: req.method,
        path: req.originalUrl,
      },
      "API Error"
    );

    /*
     * CORS errors should not expose internal details.
     */
    if (
      err.message ===
      "Not allowed by CORS"
    ) {
      return res.status(403).json({
        success: false,
        message: "Origin not allowed",
      });
    }

    const status =
      Number(err.status) >= 400 &&
      Number(err.status) < 600
        ? Number(err.status)
        : 500;

    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Internal Server Error"
          : err.message ||
            "Request failed",
    });
  }
);

/*
 * ---------------------------------------------------------------------------
 * Startup
 * ---------------------------------------------------------------------------
 */

const PORT =
  Number(process.env.PORT) || 5000;

let server;

let weeklyWorker;
let engagementWorker;

/**
 * Start API + queues + workers.
 */
const startServer = async () => {
  try {
    /*
     * Fail early when required infrastructure is missing.
     */
    const requiredEnvironmentVariables = [
      "MONGO_URI",
      "REDIS_URL",
      "JWT_SECRET",
    ];

    const missing =
      requiredEnvironmentVariables.filter(
        (key) => !process.env[key]
      );

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(
          ", "
        )}`
      );
    }

    /*
     * Connect MongoDB before accepting API traffic.
     */
    await connectDB();

    /*
     * Schedule repeatable jobs.
     *
     * Scheduling failure is logged but doesn't prevent the
     * REST API from starting. The application can still serve
     * normal user requests.
     */
    try {
      await scheduleWeeklyJob();
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Weekly job scheduling failed"
      );
    }

    try {
      await scheduleEngagementNotifications();
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Engagement scheduling failed"
      );
    }

    /*
     * Start BullMQ consumers inside the same process.
     *
     * This is currently intentional because the deployment
     * does not require a separate paid worker service.
     */
    weeklyWorker = require(
      "./src/workers/weeklyAdjustment.worker"
    );

    engagementWorker = require(
      "./src/workers/engagementNotifications.worker"
    );

    /*
     * Start HTTP server only after MongoDB and workers
     * have been initialized.
     */
    server = app.listen(
      PORT,
      "0.0.0.0",
      () => {
        logger.info(
          {
            port: PORT,
            environment:
              process.env.NODE_ENV ||
              "development",
          },
          "FitLip API server started"
        );
      }
    );
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      "Failed to start FitLip server"
    );

    process.exit(1);
  }
};

/*
 * ---------------------------------------------------------------------------
 * Graceful shutdown
 * ---------------------------------------------------------------------------
 */

let shuttingDown = false;

const shutdown = async (
  signal
) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info(
    { signal },
    "Shutdown requested"
  );

  try {
    /*
     * Stop accepting new HTTP requests.
     */
    if (server) {
      await new Promise(
        (resolve) => {
          server.close(
            resolve
          );
        }
      );

      logger.info(
        "HTTP server closed"
      );
    }

    /*
     * Stop BullMQ workers.
     *
     * Worker.close() waits for active jobs to finish where
     * possible instead of immediately killing them.
     */
    if (weeklyWorker) {
      await weeklyWorker.close();

      logger.info(
        "Weekly adjustment worker closed"
      );
    }

    if (engagementWorker) {
      await engagementWorker.close();

      logger.info(
        "Engagement notification worker closed"
      );
    }

    /*
     * Close MongoDB.
     */
    const mongoose =
      require("mongoose");

    if (
      mongoose.connection.readyState !==
      0
    ) {
      await mongoose.connection.close();

      logger.info(
        "MongoDB connection closed"
      );
    }

    /*
     * Close Redis.
     */
    const redisConnection =
      require("./src/config/redis");

    if (
      redisConnection &&
      redisConnection.status !==
        "end"
    ) {
      await redisConnection.quit();

      logger.info(
        "Redis connection closed"
      );
    }

    logger.info(
      "FitLip server shut down cleanly"
    );

    process.exit(0);
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      "Error during server shutdown"
    );

    process.exit(1);
  }
};

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "uncaughtException",
  (error) => {
    logger.error(
      {
        err: error,
      },
      "UNCAUGHT EXCEPTION"
    );

    shutdown(
      "uncaughtException"
    );
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    logger.error(
      {
        err: error,
      },
      "UNHANDLED PROMISE REJECTION"
    );

    shutdown(
      "unhandledRejection"
    );
  }
);

startServer();

module.exports = app;