const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");

const processExpiredRequests = async (req, res) => {
  try {
    const now = new Date();
    // 10 days + 1 day buffer for Fan Calls (11 days total)
    const elevenDaysAgo = new Date(now.getTime() - (11 * 24 * 60 * 60 * 1000));
    // 20 days + 1 day buffer for other requests (21 days total)
    const twentyOneDaysAgo = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000));

    // Fetch ALL accepted requests to avoid native MongoDB date type parsing errors
    const allAccepted = await requestdb.find({ status: "accepted" }).exec();

    const expiredAcceptedRequests = allAccepted.filter(request => {
      const requestDate = new Date(isNaN(request.createdAt) ? request.createdAt : parseInt(request.createdAt));
      
      if (request.type === "Fan Call") {
        return requestDate < elevenDaysAgo;
      } else {
        return requestDate < twentyOneDaysAgo;
      }
    });

    // Find all pending requests that have expired
    const expiredPendingRequests = await requestdb.find({
      status: "request",
      expiresAt: { $lt: new Date() }
    }).exec();

    const allExpiredRequests = [...expiredAcceptedRequests, ...expiredPendingRequests];
    console.log(`Processing ${allExpiredRequests.length} expired requests (${expiredPendingRequests.length} pending, ${expiredAcceptedRequests.length} accepted past due)`);

    for (const request of allExpiredRequests) {
      try {
        // 1. Update the status to expired regardless of type
        request.status = "expired";
        await request.save();

        const hostType = request.type || "Fan meet";
        const isFanCall = hostType === "Fan Call";

        // 2. CRITICAL PROTECTION: Only refund if it has a price AND it is NOT a Fan Call
        if (request.price > 0 && !isFanCall) {
          const user = await userdb.findOne({ _id: request.userid }).exec();
          if (user) {
            let userBalance = parseFloat(user.balance) || 0;
            let refundAmount = parseFloat(request.price);

            // Credit the fan's main balance directly
            user.balance = String(userBalance + refundAmount);
            
            // Clean up pending balance if tracking exists
            let userPending = parseFloat(user.pending) || 0;
            if (userPending > 0) {
              user.pending = String(Math.max(0, userPending - refundAmount));
            }
            
            await user.save();

            // Create refund balance history
            const refundHistory = {
              userid: request.userid,
              details: `${hostType} request expired - automatic refund processed`,
              spent: "0",
              income: `${refundAmount}`,
              date: `${Date.now().toString()}`
            };
            await historydb.create(refundHistory);

            // Send Refund Notifications
            await sendEmail(request.userid, `Your ${hostType.toLowerCase()} request has expired and been refunded`);
            await pushActivityNotification(request.userid, `Your ${hostType.toLowerCase()} request has expired and been refunded`, "request_expired");

            console.log(`✅ Refunded ${refundAmount} to user ${request.userid} for ${hostType} request (ID: ${request._id})`);
          }
        } else {
          // 3. NO-MONEY BLOCK: For free requests OR Fan Calls, just notify them of the expiration
          const notificationMessage = isFanCall 
            ? `Your fan call request has expired` 
            : `Your ${hostType.toLowerCase()} request has expired`;

          await sendEmail(request.userid, notificationMessage);
          await pushActivityNotification(request.userid, notificationMessage, "request_expired");

          console.log(`🕊️ Expired ${hostType} request with no refund tracking required (ID: ${request._id})`);
        }

        // 4. Notify the creator about the expiration in all scenarios
        const creatorRecord = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();
        if (creatorRecord && creatorRecord.userid) {
          await sendEmail(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`);
          await pushActivityNotification(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`, "request_expired");
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