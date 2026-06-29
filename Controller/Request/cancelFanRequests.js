const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const historydb = require("../../Creators/mainbalance");
const creatordb = require("../../Creators/creators");

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

    // Guard: already cancelled or in a final state
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

    const normalizedType = (request.type || "").toLowerCase().trim();
    const isFanCall = normalizedType.includes("fan call");

    // Only refund for non Fan Call requests
    if (!isFanCall && request.price > 0) {
      let clientbalance = parseFloat(clientuser.balance) || 0;
      let clientpending = parseFloat(clientuser.pending) || 0;
      let refundAmount = parseFloat(request.price);

      // Guard: only refund what's actually in pending
      if (clientpending >= refundAmount) {
        clientuser.balance = String(clientbalance + refundAmount);
        clientuser.pending = String(clientpending - refundAmount);
        await clientuser.save();

        await historydb.create({
          userid: userid,
          details: `${request.type || "Fan request"} request cancelled - refund processed (${id})`,
          spent: "0",
          income: `${refundAmount}`,
          date: `${Date.now().toString()}`
        });
      } else {
        console.warn(`⚠️  Pending (${clientpending}) less than refund amount (${refundAmount}) for cancelled request ${id}`);
      }
    }

    // Delete the request
    const deletedRequest = await requestdb.findByIdAndDelete(id).exec();

    if (deletedRequest) {
      emitFanRequestStatusUpdate({
        requestId: id,
        status: 'cancelled',
        userid: userid,
        creator_portfolio_id: creator_portfolio_id,
        message: '🚫 Fan request was cancelled'
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