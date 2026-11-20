const requestdb = require("../Creators/requsts");
const creatordb = require("../Creators/creators");
const admindb = require("../Creators/admindb");
const { pushActivityNotification, pushAdminNotification } = require("./sendPushnot");

const attempt = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.error(`[sessionNotifications] ${label} failed:`, e.message);
  }
};

const creatorUserIdFor = async (request) => {
  try {
    const rec = await creatordb.findOne({ _id: request.creator_portfolio_id }).exec();
    return rec?.userid || null;
  } catch {
    return null;
  }
};

// ── "Started" ─────────────────────────────────────────────────────────────
// Claims the booking first (atomic), so it can only ever be sent once.
const notifySessionStarted = async (requestId) => {
  const request = await requestdb.findOneAndUpdate(
    { _id: requestId, status: "accepted", startNotified: { $ne: true } },
    { $set: { startNotified: true } },
    { new: true }
  );
  if (!request) return false;

  const hostType = request.type || "Fan meet";
  const message = "🎉 Your " + hostType + " has started!";
  const creatorUserId = await creatorUserIdFor(request);

  await attempt("push fan (start)", () => pushActivityNotification(request.userid, message, "session_update"));
  await attempt("admindb fan (start)", () => admindb.create({ userid: request.userid, message, seen: false }));

  if (creatorUserId) {
    await attempt("push creator (start)", () => pushActivityNotification(creatorUserId, message, "session_update"));
    await attempt("admindb creator (start)", () => admindb.create({ userid: creatorUserId, message, seen: false }));
  }
  return true;
};

// ── "Ended" ───────────────────────────────────────────────────────────────
const notifySessionEnded = async (requestId) => {
  const request = await requestdb.findOneAndUpdate(
    { _id: requestId, status: "accepted", sessionNotified: { $ne: true } },
    { $set: { sessionNotified: true } },
    { new: true }
  );
  if (!request) return false;

  const word = (request.type || "").toLowerCase() === "fan date" ? "date" : "meet";
  const endTitle = `Your ${word} has ended`;
  const fanMessage = "The scheduled time for your booking is over.";
  const creatorMessage = `The scheduled time is over. If the ${word} has finished, click Mark as Complete button.`;
  const pushOpts = { title: endTitle, type: "activity", url: "/notifications/activity" };
  const creatorUserId = await creatorUserIdFor(request);

  await attempt("push fan (end)", () => pushAdminNotification(request.userid, fanMessage, "activity", pushOpts));
  await attempt("admindb fan (end)", () =>
    admindb.create({ userid: request.userid, title: endTitle, message: fanMessage, seen: false })
  );

  if (creatorUserId) {
    await attempt("push creator (end)", () => pushAdminNotification(creatorUserId, creatorMessage, "activity", pushOpts));
    await attempt("admindb creator (end)", () =>
      admindb.create({ userid: creatorUserId, title: endTitle, message: creatorMessage, seen: false })
    );
  }
  return true;
};

// ── Sweep: used by the 1-minute job and as a backup by the 5-minute job ───
const processSessionNotifications = async () => {
  const now = new Date();

  // Backup for any "started" the instant send missed (never after the session is already over)
  const needStart = await requestdb
    .find({ status: "accepted", sessionEndAt: { $gt: now }, startNotified: { $ne: true } })
    .select("_id")
    .lean();
  for (const r of needStart) {
    await attempt("start sweep", () => notifySessionStarted(r._id));
  }

  const needEnd = await requestdb
    .find({ status: "accepted", sessionEndAt: { $lt: now }, sessionNotified: { $ne: true } })
    .select("_id")
    .lean();
  for (const r of needEnd) {
    await attempt("end sweep", () => notifySessionEnded(r._id));
  }
};

module.exports = { notifySessionStarted, notifySessionEnded, processSessionNotifications };