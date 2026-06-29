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
    // First check if request exists at all
    const existingRequest = await requestdb.findOne({
      _id: requestId,
      creator_portfolio_id: creator_portfolio_id,
      userid: userid
    }).exec();

    if (!existingRequest) {
      return res.status(404).json({
        ok: false,
        message: "Request not found"
      });
    }

    // If already accepted, just return success silently
    // This handles the case where creator refreshes and accepts again
    if (existingRequest.status === "accepted") {
      return res.status(200).json({
        ok: true,
        message: "Request already accepted"
      });
    }

    // If already declined, expired, completed or cancelled, block it
    if (["declined", "expired", "completed", "cancelled"].includes(existingRequest.status)) {
      return res.status(400).json({
        ok: false,
        message: `Request has already been ${existingRequest.status}`
      });
    }

    // Check if request has expired
    if (new Date() > new Date(existingRequest.expiresAt)) {
      const user = await userdb.findOne({ _id: userid }).exec();
      if (user) {
        let userBalance = parseFloat(user.balance) || 0;
        let userPending = parseFloat(user.pending) || 0;
        let refundAmount = parseFloat(existingRequest.price);

        if (userPending >= refundAmount) {
          user.balance = String(userBalance + refundAmount);
          user.pending = String(userPending - refundAmount);
          await user.save();

          await historydb.create({
            userid,
            details: `Fan request expired - refund processed (${requestId})`,
            spent: "0",
            income: `${refundAmount}`,
            date: `${Date.now().toString()}`
          });
        }

        existingRequest.status = "expired";
        await existingRequest.save();
      }

      return res.status(400).json({
        ok: false,
        message: "Request has expired"
      });
    }

    // Accept the request
    existingRequest.status = "accepted";

    const normalizedType = (existingRequest.type || "").toLowerCase().trim();
    const isFanCall = normalizedType.includes("fan call");
    const expirationDays = isFanCall ? 10 : 20;
    existingRequest.expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

    await existingRequest.save();

    const hostType = existingRequest.type || "Fan request";

    await sendEmail(userid, `Creator has accepted your ${hostType.toLowerCase()} request`);
    await pushActivityNotification(userid, `Creator has accepted your ${hostType.toLowerCase()} request`, "request_accepted");

    await admindb.create({
      userid: userid,
      message: `Creator has accepted your ${hostType.toLowerCase()} request`,
      seen: false
    });

    return res.status(200).json({
      ok: true,
      message: `${hostType} request accepted successfully`
    });

  } catch (err) {
    console.error("Error accepting request:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = acceptFanRequest;