const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");

const processExpiredRequests = async (req, res) => {
  try {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
    const twentyDaysAgo = new Date(now.getTime() - (20 * 24 * 60 * 60 * 1000));

    // Find all accepted Fan Call requests that are older than 10 days
    const expiredFanCallRequests = await requestdb.find({
      status: "accepted",
      type: "Fan Call",
      createdAt: { $lt: tenDaysAgo }
    }).exec();

    // Find all accepted non-Fan Call requests that are older than 20 days
    const expiredOtherRequests = await requestdb.find({
      status: "accepted",
      type: { $ne: "Fan Call" },
      createdAt: { $lt:  twentyDaysAgo }
    }).exec();

    // Combine all accepted requests that should be expired
    const expiredAcceptedRequests = [...expiredFanCallRequests, ...expiredOtherRequests];

    // Find all pending requests that have expired (existing logic)
    const expiredPendingRequests = await requestdb.find({
      status: "request",
      expiresAt: { $lt: new Date() }
    }).exec();

    const allExpiredRequests = [...expiredAcceptedRequests, ...expiredPendingRequests];
    console.log(`Processing ${allExpiredRequests.length} expired requests (${expiredFanCallRequests.length} Fan Call 10d, ${expiredOtherRequests.length} other 20d, ${expiredPendingRequests.length} pending)`);

    for (const request of allExpiredRequests) {
      try {
        // Update request status to expired
        request.status = "expired";
        await request.save();

        // Get host type for notifications
        const hostType = request.type || "Fan meet";

        // Refund logic: Check if request has a price to determine if refund is needed
        // This covers all paid requests (Fan Call, Fan Date, Fan Meet)
        if (request.price > 0) {
          const user = await userdb.findOne({ _id: request.userid }).exec();
          if (user) {
            let userBalance = parseFloat(user.balance) || 0;
            let userPending = parseFloat(user.pending) || 0;
            let refundAmount = parseFloat(request.price);

            // Refund logic: Try to refund the full amount, but if pending is less, refund what's available
            // This handles edge cases where pending might have been partially refunded or there's a discrepancy
            if (userPending > 0 && refundAmount > 0) {
              const actualRefundAmount = Math.min(userPending, refundAmount);

              user.balance = String(userBalance + actualRefundAmount);
              user.pending = String(Math.max(0, userPending - actualRefundAmount));
              await user.save();

              // Log warning if refund amount doesn't match expected
              if (actualRefundAmount < refundAmount) {
                console.warn(`⚠️  Partial refund for request ${request._id}: Expected ${refundAmount}, refunded ${actualRefundAmount}. User pending: ${userPending}`);
              }

              // Create refund history with dynamic host type
              const refundHistory = {
                userid: request.userid,
                details: `${hostType} request expired - automatic refund processed`,
                spent: "0",
                income: `${actualRefundAmount}`,
                date: `${Date.now().toString()}`
              };
              await historydb.create(refundHistory);

              // Send notifications with dynamic host type
              await sendEmail(request.userid, `Your ${hostType.toLowerCase()} request has expired and been refunded`);
              await pushActivityNotification(request.userid, `Your ${hostType.toLowerCase()} request has expired and been refunded`, "request_expired");

              // Find creator's actual user ID and send notification
              const creatorRecord = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();
              if (creatorRecord && creatorRecord.userid) {
                await sendEmail(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`);
                await pushActivityNotification(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`, "request_expired");
              }

              console.log(`✅ Refunded ${actualRefundAmount} to user ${request.userid} for ${hostType} request (Request ID: ${request._id})`);
            } else {
              console.warn(`⚠️  Cannot refund request ${request._id}: userPending=${userPending}, refundAmount=${refundAmount}`);

              // Still send notification even if refund failed
              await sendEmail(request.userid, `Your ${hostType.toLowerCase()} request has expired`);
              await pushActivityNotification(request.userid, `Your ${hostType.toLowerCase()} request has expired`, "request_expired");
            }
          }
        } else {
          // For free requests (price = 0), just send notification without refund
          await sendEmail(request.userid, `Your ${hostType.toLowerCase()} request has expired`);
          await pushActivityNotification(request.userid, `Your ${hostType.toLowerCase()} request has expired`, "request_expired");

          // Find creator's actual user ID and send notification
          const creatorRecord = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();
          if (creatorRecord && creatorRecord.userid) {
            await sendEmail(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`);
            await pushActivityNotification(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`, "request_expired");
          }
        }
      } catch (err) {
        console.error(`Error processing expired request ${request._id}:`, err);
      }
    }

    return res.status(200).json({
      ok: true,
      message: `Processed ${allExpiredRequests.length} expired requests`
    });

  } catch (err) {
    console.error("Error processing expired requests:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = processExpiredRequests;
