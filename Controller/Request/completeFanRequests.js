const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");

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
    // Find the request
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

    // Guard: prevent double payment
    if (request.paid === true) {
      return res.status(400).json({
        ok: false,
        message: "This request has already been paid."
      });
    }

    // Update request status to completed and mark as paid
    request.status = "completed";
    request.paid = true;
    await request.save();

    // Transfer money from user's pending to creator's earnings
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
    const hostType = request.type || creatorProfile?.hosttype || "Fan meet";

    if (user && creator) {
      let userPending = parseFloat(user.pending) || 0;
      let creatorEarnings = parseFloat(creator.earnings) || 0;
      let transferAmount = parseFloat(request.price);

      // Guard: make sure pending actually covers the transfer
      if (userPending < transferAmount) {
        console.warn(`⚠️  Pending (${userPending}) is less than transfer amount (${transferAmount}) for request ${request._id}`);
        return res.status(400).json({
          ok: false,
          message: "Insufficient pending balance. Please contact support."
        });
      }

      // Deduct from user's pending
      user.pending = String(userPending - transferAmount);
      await user.save();

      // Add to creator's earnings
      creator.earnings = String(creatorEarnings + transferAmount);
      await creator.save();

      // Create transaction histories
      await historydb.create({
        userid,
        details: `${hostType} completed - payment transferred to creator (${requestId})`,
        spent: `${transferAmount}`,
        income: "0",
        date: `${Date.now().toString()}`
      });

      await historydb.create({
        userid: creator_portfolio_id,
        details: `${hostType} completed - payment received (${requestId})`,
        spent: "0",
        income: `${transferAmount}`,
        date: `${Date.now().toString()}`
      });
    }

    // Send notifications
    await sendEmail(userid, `${hostType} completed successfully!`);
    await pushActivityNotification(userid, `${hostType} completed successfully!`, "request_completed");
    
    if (creator && creator._id) {
      await sendEmail(creator._id, `${hostType} completed - payment received!`);
      await pushActivityNotification(creator._id, `${hostType} completed - payment received!`, "request_completed");
    }

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