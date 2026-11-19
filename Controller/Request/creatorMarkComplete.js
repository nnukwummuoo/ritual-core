const requestdb = require("../../Creators/requsts");
const creatordb = require("../../Creators/creators");
const admindb = require("../../Creators/admindb");
const userdb = require("../../Creators/userdb");
const sendEmail = require("../../utiils/sendEmailnot");
const { pushAdminNotification } = require("../../utiils/sendPushnot");

const TITLE = "Booking marked as complete";
const buildMessage = (creatorName) =>
  `${creatorName} has marked this booking as complete.\n` +
  "Please mark it as complete on your side too — whether the meet went well or not.\n" +
  "This releases the payment. You can do it from the request card.";

// POST /fanrequest/creator-mark-complete — protected (verifyJWT sets req.userId)
// The creator confirms the meet is over; the fan is notified to release payment.
const creatorMarkComplete = async (req, res) => {
  const { requestId } = req.body;
  const creatorUserId = String(req.userId || "");

  if (!requestId) {
    return res.status(400).json({ ok: false, message: "Missing requestId" });
  }

  try {
    const request = await requestdb.findById(requestId).exec();
    if (!request) {
      return res.status(404).json({ ok: false, message: "Booking not found" });
    }

    // Only the creator this booking belongs to may do this. creator_portfolio_id can be
    // either the creator's user id or the portfolio record id, so accept both.
    const ownerIds = [String(request.creator_portfolio_id)];
    try {
      const portfolio = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();
      if (portfolio?.userid) ownerIds.push(String(portfolio.userid));
    } catch {
      // creator_portfolio_id wasn't a valid portfolio _id — fine, user-id match still applies
    }
    if (!ownerIds.includes(creatorUserId)) {
      return res.status(403).json({ ok: false, message: "This booking does not belong to you" });
    }

    if (request.type === "Fan call") {
      return res.status(400).json({ ok: false, message: "Fan calls complete automatically" });
    }
    if (request.status !== "accepted") {
      return res.status(400).json({ ok: false, message: "Only accepted bookings can be marked as complete" });
    }
    if (request.creatorMarkedComplete) {
      return res.status(200).json({ ok: true, alreadyMarked: true });
    }

    // Atomic guard so a double-click / retry can never notify the fan twice
    const updated = await requestdb.findOneAndUpdate(
      { _id: requestId, status: "accepted", creatorMarkedComplete: { $ne: true } },
      { $set: { creatorMarkedComplete: true, creatorMarkedCompleteAt: new Date() } },
      { new: true }
    );
    if (!updated) {
      return res.status(200).json({ ok: true, alreadyMarked: true });
    }

   const fanId = request.userid;

    // Use the creator's username in the message ("Jane has marked…")
    let creatorName = "The creator";
    try {
      const creatorUser = await userdb.findById(creatorUserId).select("firstname").lean();
      if (creatorUser?.firstname) creatorName = creatorUser.firstname;
    } catch (e) {
      console.error("[creatorMarkComplete] could not load creator name:", e.message);
    }
    const MESSAGE = buildMessage(creatorName);

    try {
      await admindb.create({ userid: fanId, title: TITLE, message: MESSAGE, seen: false });
    } catch (e) {
      console.error("[creatorMarkComplete] in-app notification failed:", e.message);
    }
    try {
      await pushAdminNotification(fanId, MESSAGE, "activity", {
        title: TITLE,
        type: "activity",
        url: "/notifications/activity",
      });
    } catch (e) {
      console.error("[creatorMarkComplete] push failed:", e.message);
    }
    try {
      await sendEmail(fanId, `${TITLE}. ${MESSAGE.replace(/\n/g, " ")}`);
    } catch (e) {
      console.error("[creatorMarkComplete] email failed:", e.message);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[creatorMarkComplete] failed:", err);
    return res.status(500).json({ ok: false, message: "Could not mark this booking as complete" });
  }
};

module.exports = creatorMarkComplete;