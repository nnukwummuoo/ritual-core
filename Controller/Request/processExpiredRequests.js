const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");

const refundUser = async (request, hostType) => {
  const user = await userdb.findOne({ _id: request.userid }).exec();
  if (!user) {
    console.warn(`⚠️  User not found for request ${request._id}, userid: ${request.userid}`);
    return false;
  }

  let userBalance = parseFloat(user.balance) || 0;
  let userPending = parseFloat(user.pending) || 0;
  let refundAmount = parseFloat(request.price);

  if (refundAmount <= 0) return false;

  const actualRefundAmount = Math.min(userPending, refundAmount) > 0
    ? Math.min(userPending, refundAmount)
    : refundAmount;

  user.balance = String(userBalance + actualRefundAmount);
  user.pending = String(Math.max(0, userPending - actualRefundAmount));
  await user.save();

  if (actualRefundAmount < refundAmount) {
    console.warn(`⚠️  Partial refund for ${request._id}: expected ${refundAmount}, gave ${actualRefundAmount}`);
  }

  await historydb.create({
    userid: request.userid,
    details: `${hostType} request expired - automatic refund processed (${request._id})`,
    spent: "0",
    income: `${actualRefundAmount}`,
    date: `${Date.now().toString()}`
  });

  console.log(`✅ Refunded ${actualRefundAmount} to user ${request.userid} for ${hostType} (Request: ${request._id})`);
  return true;
};

const notifyBoth = async (request, hostType, wasRefunded) => {
  const userMsg = wasRefunded
    ? `Your ${hostType.toLowerCase()} request has expired and been refunded`
    : `Your ${hostType.toLowerCase()} request has expired`;

  await sendEmail(request.userid, userMsg);
  await pushActivityNotification(request.userid, userMsg, "request_expired");

  const creatorRecord = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();
  if (creatorRecord?.userid) {
    await sendEmail(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`);
    await pushActivityNotification(creatorRecord.userid, `A ${hostType.toLowerCase()} request has expired`, "request_expired");
  }
};

const backfillMissedRefunds = async () => {
  const missedOther = await requestdb.find({
    status: "expired",
    type: { $ne: "Fan Call" },
    price: { $gt: 0 }
  }).exec();

  console.log(`Backfill: checking ${missedOther.length} potentially missed refunds`);

  let backfilled = 0;

  for (const request of missedOther) {
    try {
      const refundExists = await historydb.findOne({
        userid: request.userid,
        details: { $regex: request._id.toString() }
      }).exec();

      if (refundExists) continue;

      const hostType = request.type || "Fan meet";
      const wasRefunded = await refundUser(request, hostType);
      await notifyBoth(request, hostType, wasRefunded);
      backfilled++;
    } catch (err) {
      console.error(`Backfill error for request ${request._id}:`, err);
    }
  }

  console.log(`Backfill complete: processed ${backfilled} missed refunds`);
};

 
const processEndedSessions = async () => {
  const now = new Date();

  const startedSessions = await requestdb.find({
    status: "accepted",
    sessionEndAt: { $exists: true },
    startNotified: { $ne: true }
  }).exec();

  console.log("Processing " + startedSessions.length + " started sessions");

  for (const request of startedSessions) {
    try {
      const hostType = request.type || "Fan meet";
      const creatorRecord = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();

      const fanMessage = "🎉 Your " + hostType + " has started!";
      const creatorMessage = "🎉Your " + hostType + " has started!";

      try { await sendEmail(request.userid, fanMessage); } catch(e) { console.error("sendEmail fan failed: " + e.message); }
      try { await pushActivityNotification(request.userid, fanMessage, "session_update"); } catch(e) { console.error("push fan failed: " + e.message); }
      try { await admindb.create({ userid: request.userid, message: fanMessage, seen: false }); } catch(e) { console.error("admindb fan failed: " + e.message); }

      if (creatorRecord?.userid) {
        try { await sendEmail(creatorRecord.userid, creatorMessage); } catch(e) { console.error("sendEmail creator failed: " + e.message); }
        try { await pushActivityNotification(creatorRecord.userid, creatorMessage, "session_update"); } catch(e) { console.error("push creator failed: " + e.message); }
        try { await admindb.create({ userid: creatorRecord.userid, message: creatorMessage, seen: false }); } catch(e) { console.error("admindb creator failed: " + e.message); }
      }

      request.startNotified = true;
      await request.save();

    } catch (err) {
      console.error("Error processing started session " + request._id + ": " + err.message);
    }
  }

  const endedSessions = await requestdb.find({
    status: "accepted",
    sessionEndAt: { $lt: now },
    sessionNotified: { $ne: true }
  }).exec();

  console.log("Processing " + endedSessions.length + " ended sessions");

  for (const request of endedSessions) {
    try {
      const hostType = request.type || "Fan meet";
      const creatorRecord = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();

      const fanMessage = "✅ Your " + hostType + " has ended! Please mark it as complete in your request card so your creator can receive payment.";
      const creatorMessage = "✅ Your " + hostType + " has ended. Your fan will be notified to mark it as complete — once they do, your payment is released instantly. If they don't, contact Mmeko Support and we will release your payment immediately.";

      try { await sendEmail(request.userid, fanMessage); } catch(e) { console.error("sendEmail fan failed: " + e.message); }
      try { await pushActivityNotification(request.userid, fanMessage, "session_update"); } catch(e) { console.error("push fan failed: " + e.message); }
      try { await admindb.create({ userid: request.userid, message: fanMessage, seen: false }); } catch(e) { console.error("admindb fan failed: " + e.message); }

      if (creatorRecord?.userid) {
        try { await sendEmail(creatorRecord.userid, creatorMessage); } catch(e) { console.error("sendEmail creator failed: " + e.message); }
        try { await pushActivityNotification(creatorRecord.userid, creatorMessage, "session_update"); } catch(e) { console.error("push creator failed: " + e.message); }
        try { await admindb.create({ userid: creatorRecord.userid, message: creatorMessage, seen: false }); } catch(e) { console.error("admindb creator failed: " + e.message); }
      }

      request.sessionNotified = true;
      await request.save();

    } catch (err) {
      console.error("Error processing ended session " + request._id + ": " + err.message);
    }
  }
};

// Core logic — no req/res, used by cron
const processExpiredRequestsCore = async () => {
  const now = new Date();

   // Backfill missed refunds from threshold change (Fan Call excluded — no refund applies)
    await backfillMissedRefunds();
    await processEndedSessions();

    // Fan Call: expire after 10 days from acceptance, no refund
const expiredFanCallRequests = await requestdb.find({
  status: "accepted",
  type: "Fan Call",
  expiresAt: { $lt: now }
}).exec();

// Other types: expire after 20 days from acceptance, refund applies
const expiredOtherRequests = await requestdb.find({
  status: "accepted",
  type: { $ne: "Fan Call" },
  expiresAt: { $lt: now }
}).exec();

    // Pending requests that passed their expiresAt
    const expiredPendingRequests = await requestdb.find({
      status: "request",
      expiresAt: { $lt: now }
    }).exec();

  const allExpiredRequests = [
    ...expiredFanCallRequests,
    ...expiredOtherRequests,
    ...expiredPendingRequests
  ];

  console.log(`Processing ${allExpiredRequests.length} expired requests (${expiredFanCallRequests.length} Fan Call 10d, ${expiredOtherRequests.length} other 20d, ${expiredPendingRequests.length} pending)`);

  for (const request of allExpiredRequests) {
    try {
      request.status = "expired";
      await request.save();

      const hostType = request.type || "Fan meet";
      const isFanCall = request.type === "Fan Call";

      if (!isFanCall && request.price > 0) {
        const wasRefunded = await refundUser(request, hostType);
        await notifyBoth(request, hostType, wasRefunded);
      } else {
        await notifyBoth(request, hostType, false);
      }
    } catch (err) {
      console.error(`Error processing request ${request._id}:`, err);
    }
  }

  console.log(`Done processing ${allExpiredRequests.length} expired requests`);
};

// HTTP controller version — used by the route
const processExpiredRequests = async (req, res) => {
  try {
    await processExpiredRequestsCore();
    return res.status(200).json({ ok: true, message: "Processed successfully" });
  } catch (err) {
    console.error("Error processing expired requests:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};

module.exports = {
  core: processExpiredRequestsCore,
  controller: processExpiredRequests
};