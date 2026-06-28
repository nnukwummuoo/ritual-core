const cron = require('node-cron');
const { core } = require('./processExpiredRequests');

/**
 * Scheduled processing for expired fan meet requests
 * Runs every 5 minutes to check and process expired requests
 * - Pending requests that expired (24 hours) - refunds pending_gold
 * - Accepted requests that expired (7 days for Fan meet/Fan date, 48h for Fan Call) - refunds pending_gold
 */
class ScheduledExpiredRequests {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.lastStats = null;
  }

  /**
   * Start the scheduled expired requests processing
   */
  start() {
    // Run processing every 5 minutes (*/5 * * * *)
    this.processingTask = cron.schedule('*/5 * * * *', async () => {
      await this.runProcessing();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Run initial processing on startup
    setTimeout(() => {
      this.runProcessing();
    }, 10000); // Wait 10 seconds after startup
  }

  /**
   * Stop the scheduled processing
   */
  stop() {
    if (this.processingTask) {
      this.processingTask.destroy();
    }
  }

  /**
   * Run the processing
   */
  async runProcessing() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();

    try {
      // Call the processing function (script version, not controller version)
      await core()
      
      this.lastStats = {
        timestamp: this.lastRun,
        status: 'completed'
      };

    } catch (error) {
      console.error("Error during expired requests processing:", error);
      this.lastStats = {
        timestamp: this.lastRun,
        status: 'error',
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get the status of the processing service
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      lastStats: this.lastStats,
      nextRun: this.processingTask ? this.processingTask.nextDate() : null
    };
  }

  /**
   * Manually trigger processing
   */
  async manualProcessing() {
    await this.runProcessing();
  }
}

// Create singleton instance
const scheduledExpiredRequests = new ScheduledExpiredRequests();

module.exports = scheduledExpiredRequests;

