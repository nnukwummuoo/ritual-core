const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const historydb = require("../../Creators/mainbalance");
const creatordb = require("../../Creators/creators");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");
const { emitFanRequestStatusUpdate } = require('../../utils/socket');

const cancelFanRequest = async (req, res) => {
  const { id, userid, creator_portfolio_id } = req.body;

  if (!id) {
    return res.status(400).json({ ok: false, message: "Request ID invalid" });
  }

  try {
    const request = await requestdb.findById(id).exec();
    if (!request) {
      return res.status(404).json({ ok: false, message: "Request not found." });
    }

    if (["cancelled", "completed", "expired"].includes(request.status)) {
      return res.status(400).json({
        ok: false,
        message: `Request has already been ${request.status}`
      });
    }

    const clientuser = await userdb.findOne({ _id: userid }).exec();
    if (!clientuser) {
      return res.status(404).json({ ok: false, message: "User not found." });
    }

    const hostType = request.type || "Fan request";
    const normalizedType = (hostType || "").toLowerCase().trim();
    const isFanCall = normalizedType.includes("fan call");

    if (!isFanCall && request.price > 0) {
      let clientbalance = parseFloat(clientuser.balance) || 0;
      let clientpending = parseFloat(clientuser.pending) || 0;
      let refundAmount = parseFloat(request.price);

      if (clientpending >= refundAmount) {
        clientuser.balance = String(clientbalance + refundAmount);
        clientuser.pending = String(clientpending - refundAmount);
        await clientuser.save();

        await historydb.create({
          userid: userid,
          details: `${hostType} request cancelled - refund processed (${id})`,
          spent: "0",
          income: `${refundAmount}`,
          date: `${Date.now().toString()}`
        });
      } else {
        console.warn(`⚠️  Pending (${clientpending}) less than refund amount (${refundAmount}) for cancelled request ${id}`);
      }
    }

    const deletedRequest = await requestdb.findByIdAndDelete(id).exec();

    if (deletedRequest) {
      emitFanRequestStatusUpdate({
        requestId: id,
        status: 'cancelled',
        userid: userid,
        creator_portfolio_id: creator_portfolio_id,
        message: '🚫 Fan request was cancelled'
      });

      // Notify creator
      let creatoruser = await creatordb.findOne({ _id: creator_portfolio_id }).exec();
      if (!creatoruser) {
        creatoruser = await creatordb.findOne({ userid: creator_portfolio_id }).exec();
      }

      if (creatoruser?.userid) {
        await sendEmail(creatoruser.userid, `A fan cancelled their ${hostType.toLowerCase()} request`);
        await pushActivityNotification(creatoruser.userid, `A fan cancelled their ${hostType.toLowerCase()} request`, "request_cancelled");
        await admindb.create({
          userid: creatoruser.userid,
          message: `A fan cancelled their ${hostType.toLowerCase()} request`,
          seen: false
        });
      }

      // Notify fan
      await sendEmail(userid, `Your ${hostType.toLowerCase()} request was cancelled`);
      await pushActivityNotification(userid, `Your ${hostType.toLowerCase()} request was cancelled`, "request_cancelled");
      await admindb.create({
        userid: userid,
        message: `Your ${hostType.toLowerCase()} request was cancelled`,
        seen: false
      });

      return res.status(200).json({ ok: true, message: "Request cancelled successfully" });
    }

    return res.status(404).json({ ok: false, message: "Request not found." });

  } catch (err) {
    console.error("Error cancelling fan request:", err);
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = cancelFanRequest;