const cron = require('node-cron');
const { processExpiredPayments, pruneDeadTransactions } = require('../Controller/accountPayment/web3payment');

/**
 * Cron job to process expired Web3 payments
 * Runs every minute to check for expired payments
 */
const startExpiredPaymentsCron = () => {
  console.log('🕐 Starting expired payments cron job...');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      console.log(`🕐 [CRON] Running expired payments check at ${new Date().toISOString()}`);
      await processExpiredPayments();
    } catch (error) {
      console.error('❌ [CRON] Error in expired payments cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('✅ Expired payments cron job started (runs every minute)');
};

/**
 * Cron job to permanently delete dead (never-completed) payment orders
 * older than 90 days. Confirmed/finished payments are never touched.
 * Runs once a day at 03:00 UTC — low frequency since this is just housekeeping.
 */
const startPruneDeadTransactionsCron = () => {
  console.log('🧹 Starting dead-transaction cleanup cron job...');

  cron.schedule('0 3 * * *', async () => {
    try {
      console.log(`🧹 [CRON] Running dead transaction cleanup at ${new Date().toISOString()}`);
      await pruneDeadTransactions();
    } catch (error) {
      console.error('❌ [CRON] Error in dead-transaction cleanup cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('✅ Dead-transaction cleanup cron job started (runs daily at 03:00 UTC)');
};

module.exports = {
  startExpiredPaymentsCron,
  startPruneDeadTransactionsCron
};