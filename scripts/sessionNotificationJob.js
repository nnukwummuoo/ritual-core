const cron = require("node-cron");
const { processSessionNotifications } = require("../utiils/sessionNotifications");

// Runs every minute so "meet ended" notifications go out almost exactly on time.
let running = false;

const start = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      if (running) return;
      running = true;
      try {
        await processSessionNotifications();
      } catch (err) {
        console.error("[sessionNotificationJob] error:", err.message);
      } finally {
        running = false;
      }
    },
    { scheduled: true, timezone: "UTC" }
  );
};

module.exports = { start };