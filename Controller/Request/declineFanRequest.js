const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const historydb = require("../../Creators/mainbalance");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
const { pushmessage } = require("../../utiils/sendPushnot");
const { emitFanRequestStatusUpdate } = require('../../utils/socket');

const declineFanRequest = async (req, res) => {
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

    if (existingRequest.status === "declined") {
      return res.status(200).json({
        ok: true,
        message: "Request already declined"
      });
    }

    if (["accepted", "expired", "completed", "cancelled"].includes(existingRequest.status)) {
      return res.status(400).json({
        ok: false,
        message: `Request has already been ${existingRequest.status} and cannot be declined`
      });
    }

    existingRequest.status = "declined";
    await existingRequest.save();

    const hostType = existingRequest.type || "Fan request";
    const normalizedType = (hostType || "").toLowerCase().trim();
    const isFanCall = normalizedType.includes("fan call");

    if (!isFanCall && existingRequest.price > 0) {
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
            details: `${hostType} request declined - refund processed (${requestId})`,
            spent: "0",
            income: `${refundAmount}`,
            date: `${Date.now().toString()}`
          });
        } else {
          console.warn(`⚠️  Pending (${userPending}) less than refund amount (${refundAmount}) for declined request ${requestId}`);
        }
      }
    }

    // Emit socket event
    emitFanRequestStatusUpdate({
      requestId: existingRequest._id,
      status: 'declined',
      userid: userid,
      creator_portfolio_id: creator_portfolio_id,
      message: `❌ ${hostType} request was declined`
    });

    await sendEmail(userid, `Creator has declined your ${hostType.toLowerCase()} request`);
    await pushmessage(userid, `Creator has declined your ${hostType.toLowerCase()} request`, "/icons/m-logo.png");

    await admindb.create({
      userid: userid,
      message: `Creator has declined your ${hostType.toLowerCase()} request`,
      seen: false
    });

    await sendEmail(creator_portfolio_id, `You declined a ${hostType.toLowerCase()} request`);
    await pushmessage(creator_portfolio_id, `You declined a ${hostType.toLowerCase()} request`, "/icons/m-logo.png");

    await admindb.create({
      userid: creator_portfolio_id,
      message: `You declined a ${hostType.toLowerCase()} request`,
      seen: false
    });

    return res.status(200).json({
      ok: true,
      message: `${hostType} request declined successfully`
    });

  } catch (err) {
    console.error("Error declining fan request:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = declineFanRequest;