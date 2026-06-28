const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
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
    details: `${hostType} request expired - automatic refund processed`,
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

// One-time backfill for non-Fan Call requests missed during threshold change (14 -> 20 days)
const backfillMissedRefunds = async () => {
  const now = new Date();
  const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

  const missedOther = await requestdb.find({
    status: "expired",
    type: { $ne: "Fan Call" },
    price: { $gt: 0 },
    createdAt: { $gt: twentyDaysAgo }
  }).exec();

  console.log(`Backfill: checking ${missedOther.length} potentially missed refunds`);

  let backfilled = 0;

  for (const request of missedOther) {
    try {
      const refundExists = await historydb.findOne({
        userid: request.userid,
        details: { $regex: "expired - automatic refund processed" }
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

const processExpiredRequests = async (req, res) => {
  try {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

    // Backfill missed refunds from threshold change (Fan Call excluded — no refund applies)
    await backfillMissedRefunds();

    // Fan Call: expire after 10 days, no refund
    const expiredFanCallRequests = await requestdb.find({
      status: "accepted",
      type: "Fan Call",
      createdAt: { $lt: tenDaysAgo }
    }).exec();

    // Other types: expire after 20 days, refund applies
    const expiredOtherRequests = await requestdb.find({
      status: "accepted",
      type: { $ne: "Fan Call" },
      createdAt: { $lt: twentyDaysAgo }
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
          // Paid request (Fan Date, Fan Meet, etc.) — refund and notify
          const wasRefunded = await refundUser(request, hostType);
          await notifyBoth(request, hostType, wasRefunded);
        } else {
          // Fan Call or free request — notify only, no refund
          await notifyBoth(request, hostType, false);
        }
      } catch (err) {
        console.error(`Error processing request ${request._id}:`, err);
      }
    }

    return res.status(200).json({
      ok: true,
      message: `Processed ${allExpiredRequests.length} expired requests`
    });

  } catch (err) {
    console.error("Error processing expired requests:", err);
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = processExpiredRequests;