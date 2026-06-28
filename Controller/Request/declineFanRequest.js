const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const historydb = require("../../Creators/mainbalance");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
const { pushmessage } = require("../../utiils/sendPushnot");

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
    // Find request without status filter first
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

    // If already declined, return success silently — no double refund
    if (existingRequest.status === "declined") {
      return res.status(200).json({
        ok: true,
        message: "Request already declined"
      });
    }

    // Block if already in a final state
    if (["accepted", "expired", "completed", "cancelled"].includes(existingRequest.status)) {
      return res.status(400).json({
        ok: false,
        message: `Request has already been ${existingRequest.status} and cannot be declined`
      });
    }

    // Update request status to declined
    existingRequest.status = "declined";
    await existingRequest.save();

    const hostType = existingRequest.type || "Fan meet";
    const normalizedType = (hostType || "").toLowerCase().trim();
    const isFanCall = normalizedType.includes("fan call");

    // Only refund for non Fan Call requests
    if (!isFanCall && existingRequest.price > 0) {
      const user = await userdb.findOne({ _id: userid }).exec();
      if (user) {
        let userBalance = parseFloat(user.balance) || 0;
        let userPending = parseFloat(user.pending) || 0;
        let refundAmount = parseFloat(existingRequest.price);

        // Guard: only refund what's actually in pending
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

    // Notifications
    await sendEmail(userid, `Your ${hostType.toLowerCase()} request has been declined`);
    await pushmessage(userid, `Your ${hostType.toLowerCase()} request has been declined`, "/icons/m-logo.png");

    await admindb.create({
      userid: userid,
      message: `Your ${hostType.toLowerCase()} request has been declined`,
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
    console.error("Error declining fan meet request:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = declineFanRequest;