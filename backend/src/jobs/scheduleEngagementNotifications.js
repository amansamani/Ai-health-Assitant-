const engagementNotificationsQueue = require("../queues/engagementNotifications.queue");

const logger = require("../config/logger");

/*
 * Engagement notification schedules.
 *
 * BullMQ cron uses UTC.
 *
 * Current FitLip schedule is designed around IST (UTC+5:30).
 *
 * Example:
 *
 *   03:00 UTC = 08:30 IST
 *
 * These are GLOBAL schedules.
 *
 * They are NOT yet individualized by every user's timezone.
 */
const SCHEDULE = [
  {
    moment: "morningKickoff",
    cron: "0 3 * * *",
    localTime: "08:30 IST",
  },

  {
    moment: "lunchReminder",
    cron: "30 8 * * *",
    localTime: "14:00 IST",
  },

  {
    moment: "waterNudge",
    cron: "0 11 * * *",
    localTime: "16:30 IST",
  },

  {
    moment: "comeback",
    cron: "30 11 * * *",
    localTime: "17:00 IST",
  },

  {
    moment: "stepNudge",
    cron: "0 13 * * *",
    localTime: "18:30 IST",
  },

  {
    moment: "workoutReminder",
    cron: "30 13 * * *",
    localTime: "19:00 IST",
  },

  {
    moment: "dinnerReminder",
    cron: "0 15 * * *",
    localTime: "20:30 IST",
  },

  {
    moment: "streakAtRisk",
    cron: "30 16 * * *",
    localTime: "22:00 IST",
  },

  {
    moment: "weeklyRecap",
    cron: "30 2 * * 1",
    localTime: "Monday 08:00 IST",
  },
];

/**
 * Remove all existing repeatable engagement schedules
 * and recreate the expected schedule.
 */
const scheduleEngagementNotifications =
  async () => {
    try {
      const repeatableJobs =
        await engagementNotificationsQueue.getRepeatableJobs();

      /*
       * Clean old schedules first.
       */
      for (const job of repeatableJobs) {
        try {
          await engagementNotificationsQueue.removeRepeatableByKey(
            job.key
          );
        } catch (error) {
          logger.error(
            {
              err: error,
              jobKey: job.key,
            },
            "Failed to remove old engagement schedule"
          );
        }
      }

      logger.info(
        {
          removed: repeatableJobs.length,
        },
        "Cleared old engagement notification schedules"
      );

      /*
       * Recreate exactly the schedules defined above.
       */
      for (const schedule of SCHEDULE) {
        await engagementNotificationsQueue.add(
          schedule.moment,
          {
            moment: schedule.moment,
            scheduledAt:
              new Date().toISOString(),
          },
          {
            repeat: {
              cron: schedule.cron,
            },

            attempts: 3,

            backoff: {
              type: "exponential",
              delay: 5000,
            },
          }
        );

        logger.info(
          {
            moment: schedule.moment,
            cron: schedule.cron,
            localTime: schedule.localTime,
          },
          "Engagement notification scheduled"
        );
      }

      logger.info(
        {
          schedules: SCHEDULE.map(
            ({
              moment,
              cron,
              localTime,
            }) => ({
              moment,
              cron,
              localTime,
            })
          ),
        },
        "All engagement notification schedules created"
      );
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Failed to schedule engagement notifications"
      );

      throw error;
    }
  };

module.exports =
  scheduleEngagementNotifications;