/*
 * Standalone BullMQ worker entry point.
 *
 * This file is executed directly by:
 *
 *   npm run start:worker
 *
 * Therefore it MUST load environment variables itself.
 *
 * server.js cannot be relied upon because server.js is not
 * executed when this file is launched independently.
 */

require("dotenv").config();

const connectDB = require("../config/db");

const logger = require("../config/logger");

let weeklyWorker;
let engagementWorker;

let shuttingDown = false;

/**
 * Start all BullMQ workers.
 */
const startWorkers = async () => {
  try {
    /*
     * Validate required environment variables before starting.
     */
    const requiredEnvironmentVariables = [
      "MONGO_URI",
      "REDIS_URL",
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
     * MongoDB must be connected before workers begin
     * processing jobs.
     */
    await connectDB();

    /*
     * Requiring the worker modules creates the BullMQ
     * Worker instances.
     */
    weeklyWorker = require(
      "./weeklyAdjustment.worker"
    );

    engagementWorker = require(
      "./engagementNotifications.worker"
    );

    logger.info(
      "All FitLip workers started successfully"
    );
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      "Worker service failed to start"
    );

    process.exit(1);
  }
};

/**
 * Gracefully close workers and database connections.
 *
 * This matters during:
 *
 * - Render deployments
 * - Docker shutdown
 * - Ctrl+C
 * - process termination
 */
const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info(
    { signal },
    "Worker shutdown requested"
  );

  try {
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
     * Close MongoDB connection if mongoose is loaded.
     */
    const mongoose = require("mongoose");

    if (
      mongoose.connection.readyState !== 0
    ) {
      await mongoose.connection.close();

      logger.info(
        "MongoDB connection closed"
      );
    }

    logger.info(
      "Worker service shut down cleanly"
    );

    process.exit(0);
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      "Error during worker shutdown"
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
      "Worker uncaught exception"
    );

    shutdown("uncaughtException");
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    logger.error(
      {
        err: error,
      },
      "Worker unhandled rejection"
    );

    shutdown("unhandledRejection");
  }
);

startWorkers();