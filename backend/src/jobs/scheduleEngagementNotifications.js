const engagementNotificationsQueue = require('../queues/engagementNotifications.queue');
const logger = require('../config/logger');

// All times below are IST (UTC+5:30) — the app's primary audience is in
// India — converted to the UTC cron strings BullMQ actually needs.
// Update the offset here if/when the user base goes more global and this
// needs to become per-user-timezone instead of one fixed schedule.
const SCHEDULE = [
  { moment: 'morningKickoff',  cron: '0 3 * * *',   ist: '8:30 AM' },
  { moment: 'lunchReminder',   cron: '30 8 * * *',  ist: '2:00 PM' },
  { moment: 'waterNudge',      cron: '0 11 * * *',  ist: '4:30 PM' },
  { moment: 'comeback',        cron: '30 11 * * *', ist: '5:00 PM' },
  { moment: 'stepNudge',       cron: '0 13 * * *',  ist: '6:30 PM' },
  { moment: 'workoutReminder', cron: '30 13 * * *', ist: '7:00 PM' },
  { moment: 'dinnerReminder',  cron: '0 15 * * *',  ist: '8:30 PM' },
  { moment: 'streakAtRisk',    cron: '30 16 * * *', ist: '10:00 PM' },
  { moment: 'weeklyRecap',     cron: '30 2 * * 1',  ist: 'Mon 8:00 AM' },
];

const scheduleEngagementNotifications = async () => {
  const repeatableJobs = await engagementNotificationsQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await engagementNotificationsQueue.removeRepeatableByKey(job.key);
  }
  logger.info({ removed: repeatableJobs.length }, "Cleared old engagement notification jobs");

  for (const { moment, cron } of SCHEDULE) {
    await engagementNotificationsQueue.add(
      moment,
      { moment },
      {
        repeat: { cron },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );
  }

  logger.info(
    { moments: SCHEDULE.map((s) => `${s.moment} (${s.ist} IST)`) },
    "Engagement notifications scheduled"
  );
};

module.exports = scheduleEngagementNotifications;
