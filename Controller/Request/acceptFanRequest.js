const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");

const acceptFanRequest = async (req, res) => {
  const {
    requestId,
    creator_portfolio_id,
    userid
  } = req.body;

  if (!requestId || !creator_portfolio_id || !userid) {
    return res.status(400).json({
      ok: false,
      message: "Missing required parameters"
    });
  }

  try {
    // Find the request
    const request = await requestdb.findOne({
      _id: requestId,
      creator_portfolio_id: creator_portfolio_id,
      userid: userid,
      status: "request"
    }).exec();

    if (!request) {
      return res.status(404).json({
        ok: false,
        message: "Request request not found or already processed"
      });
    }

    // Check if request has expired
    if (new Date() > new Date(request.expiresAt)) {
      // Move money back from pending to balance
      const user = await userdb.findOne({ _id: userid }).exec();
      if (user) {
        let userBalance = parseFloat(user.balance) || 0;
        let userPending = parseFloat(user.pending) || 0;
        let refundAmount = parseFloat(request.price);

        user.balance = String(userBalance + refundAmount);
        user.pending = String(userPending - refundAmount);
        await user.save();

        // Update request status to expired
        request.status = "expired";
        await request.save();

        // Create refund history
        const refundHistory = {
          userid,
          details: "Fan meet request expired - refund processed",
          spent: "0",
          income: `${refundAmount}`,
          date: `${Date.now().toString()}`
        };
        await historydb.create(refundHistory);
      }

      return res.status(400).json({
        ok: false,
        message: "Request has expired"
      });
    }

    // Update request status to accepted and extend expiration time
    request.status = "accepted";

    // Extend expiration based on request type:
    // - Fan Call: 10 days from acceptance
    // - Fan Meet/Date: 20 days from acceptance
    const normalizedType = (request.type || "").toLowerCase().trim();
    const isFanCall = normalizedType.includes("fan call");
    const expirationDays = isFanCall ? 10 : 20;
    request.expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

    await request.save();

    // Get host type for dynamic messages
    const hostType = request.type || "Fan meet";

    // Send notification only to the fan (userid is the fan who made the request)
    await sendEmail(userid, `Your ${hostType.toLowerCase()} request has been accepted!`);
    await pushActivityNotification(userid, `Your ${hostType.toLowerCase()} request has been accepted!`, "request_accepted");

    // Create database notification for fan
    await admindb.create({
      userid: userid,
      message: `Your ${hostType.toLowerCase()} request has been accepted!`,
      seen: false
    });

    return res.status(200).json({
      ok: true,
      message: `${hostType} request accepted successfully`
    });

  } catch (err) {
    console.error("Error accepting fan meet request:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = acceptFanRequest;
