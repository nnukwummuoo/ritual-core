const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");
const { emitFanRequestStatusUpdate } = require('../../utils/socket');

const completeFanRequest = async (req, res) => {
  const {
    requestId,
    userid,
    creator_portfolio_id
  } = req.body;

  if (!requestId || !userid || !creator_portfolio_id) {
    return res.status(400).json({
      ok: false,
      message: "Missing required parameters"
    });
  }

  try {
    // 1. Find the request
    const request = await requestdb.findOne({ 
      _id: requestId,
      userid: userid,
      creator_portfolio_id: creator_portfolio_id,
      status: "accepted"
    }).exec();

    if (!request) {
      return res.status(404).json({
        ok: false,
        message: "Accepted request not found"
      });
    }

    // 2. Check double payment guard
    if (request.paid === true) {
      return res.status(400).json({
        ok: false,
        message: "This request has already been paid."
      });
    }

    // 3. Find user and creator
    const user = await userdb.findOne({ _id: userid }).exec();
    let creator = await userdb.findOne({ _id: creator_portfolio_id }).exec();
    
    if (!creator) {
      const creatorRecord = await creatordb.findOne({ _id: creator_portfolio_id }).exec();
      if (creatorRecord) {
        creator = await userdb.findOne({ _id: creatorRecord.userid }).exec();
      }
    }

    let creatorProfile = await creatordb.findOne({ userid: creator_portfolio_id }).exec();
    if (!creatorProfile) {
      creatorProfile = await creatordb.findOne({ _id: creator_portfolio_id }).exec();
    }
    const hostType = request.type || creatorProfile?.hosttype || "Fan request";

    if (!user || !creator) {
      return res.status(404).json({
        ok: false,
        message: "User or creator not found"
      });
    }

    let userPending = parseFloat(user.pending) || 0;
    let creatorEarnings = parseFloat(creator.earnings) || 0;
    let transferAmount = parseFloat(request.price);

    // 4. Check pending covers transfer
    if (userPending < transferAmount) {
      console.warn(`⚠️  Pending (${userPending}) is less than transfer amount (${transferAmount}) for request ${request._id}`);
      return res.status(400).json({
        ok: false,
        message: "Insufficient pending balance. Please contact support."
      });
    }

    // 5. Mark request as completed and paid
    request.status = "completed";
    request.paid = true;
    await request.save();

    // 6. Deduct from user's pending
    user.pending = String(userPending - transferAmount);
    await user.save();

    // 7. Add to creator's earnings
    creator.earnings = String(creatorEarnings + transferAmount);
    await creator.save();

    // 8. Create transaction histories
    await historydb.create({
      userid,
      details: `${hostType} completed - payment transferred to creator (${requestId})`,
      spent: `${transferAmount}`,
      income: "0",
      date: `${Date.now().toString()}`
    });

    await historydb.create({
      userid: creator._id, // ← use actual creator user ID
      details: `${hostType} completed - payment received (${requestId})`,
      spent: "0",
      income: `${transferAmount}`,
      date: `${Date.now().toString()}`
    });

    // 9. Emit socket event
    emitFanRequestStatusUpdate({
      requestId: request._id,
      status: 'completed',
      userid: userid,
      creator_portfolio_id: creator_portfolio_id,
      message: `✅ ${hostType} has been completed!`
    });

    // 10. Send notifications
    await sendEmail(userid, `${hostType} completed successfully!`);
    await pushActivityNotification(userid, `${hostType} completed successfully!`, "request_completed");

    await admindb.create({
      userid: userid,
      message: `${hostType} completed successfully!`,
      seen: false
    });

    await sendEmail(creator._id, `${hostType} completed - payment received!`);
    await pushActivityNotification(creator._id, `${hostType} completed - payment received!`, "request_completed");

    await admindb.create({
      userid: creator._id,
      message: `${hostType} completed - payment received!`,
      seen: false
    });

    return res.status(200).json({
      ok: true,
      message: `${hostType} completed successfully`
    });

  } catch (err) {
    console.error("Error completing fan meet:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = completeFanRequest;