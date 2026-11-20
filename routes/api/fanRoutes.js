const express = require("express");
const router = express.Router();

// Import controllers
const createFanRequest = require("../../Controller/Request/fanRequest");
const acceptFanRequest = require("../../Controller/Request/acceptFanRequest");
const declineFanRequest = require("../../Controller/Request/declineFanRequest");
const cancelFanRequest = require("../../Controller/Request/cancelFanRequests");
const completeFanRequest = require("../../Controller/Request/completeFanRequests");
const creatorMarkComplete = require("../../Controller/Request/creatorMarkComplete");
const { notifySessionStarted } = require("../../utiils/sessionNotifications");
const verifyJWT = require("../../Middleware/verify");
const { controller: processExpiredRequests } = require("../../Controller/Request/processExpiredRequests");
const getFanRequests = require("../../Controller/Request/getFanRequests");
const sendEmail = require("../../utiils/sendEmailnot");
const { pushActivityNotification } = require("../../utiils/sendPushnot");
const admindb = require("../../Creators/admindb");
const requestdb = require("../../Creators/requsts");

// Create fan meet request
router.post("/create", createFanRequest);

// Accept fan meet request
router.post("/accept", acceptFanRequest);

// Decline fan meet request
router.post("/decline", declineFanRequest);

// Cancel fan meet request
router.post("/cancel", cancelFanRequest);

// Complete fan meet
router.post("/complete", completeFanRequest);

// Creator marks the meet/date as done → fan is notified to release payment
router.post("/creator-mark-complete", verifyJWT, creatorMarkComplete);

// Get fan meet requests for notifications
router.get("/requests", getFanRequests);

// Process expired requests (cron job endpoint)
router.post("/process-expired", processExpiredRequests);

router.post("/notify-session", async (req, res) => {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({ ok: false, message: "Missing requestId" });
  }

  try {
    // Fan date = 1 hour, everything else (Fan meet) = 30 minutes
    const existing = await requestdb.findById(requestId).select("type").lean();
    const sessionMinutes = (existing?.type || "").toLowerCase() === "fan date" ? 60 : 30;
    const sessionEndAt = new Date(Date.now() + sessionMinutes * 60 * 1000);
    await requestdb.findByIdAndUpdate(requestId, { 
      sessionEndAt,
      startNotified: false,
      sessionNotified: false 
    });

    // Tell both sides right now — no waiting for a job
    notifySessionStarted(requestId).catch((e) =>
      console.error("[notify-session] start notification failed:", e.message)
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
