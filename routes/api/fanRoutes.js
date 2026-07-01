const express = require("express");
const router = express.Router();

// Import controllers
const createFanRequest = require("../../Controller/Request/fanRequest");
const acceptFanRequest = require("../../Controller/Request/acceptFanRequest");
const declineFanRequest = require("../../Controller/Request/declineFanRequest");
const cancelFanRequest = require("../../Controller/Request/cancelFanRequests");
const completeFanRequest = require("../../Controller/Request/completeFanRequests");
const { controller: processExpiredRequests } = require("../../Controller/Request/processExpiredRequests");
const getFanRequests = require("../../Controller/Request/getFanRequests");
const sendEmail = require("../../utiils/sendEmailnot");
const { pushActivityNotification } = require("../../utiils/sendPushnot");
const admindb = require("../../Creators/admindb");

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

// Get fan meet requests for notifications
router.get("/requests", getFanRequests);

// Process expired requests (cron job endpoint)
router.post("/process-expired", processExpiredRequests);

router.post("/notify-session", async (req, res) => {
  const { fanUserid, creatorUserid, hosttype, event } = req.body;

  if (!fanUserid || !hosttype || !event) {
    return res.status(400).json({ ok: false, message: "Missing parameters" });
  }

  try {
    const fanMessage = event === 'started'
      ? `🎉 Your ${hosttype} has started!`
      : `✅ Your ${hosttype} has ended. Hope you had a great time!`;

    const creatorMessage = event === 'started'
      ? `🎉 ${hosttype} has started!`
      : `✅ ${hosttype} has ended!`;

    // Notify fan
    await sendEmail(fanUserid, fanMessage);
    await pushActivityNotification(fanUserid, fanMessage, "session_update");
    await admindb.create({ userid: fanUserid, message: fanMessage, seen: false });

    // Notify creator
    if (creatorUserid) {
      await sendEmail(creatorUserid, creatorMessage);
      await pushActivityNotification(creatorUserid, creatorMessage, "session_update");
      await admindb.create({ userid: creatorUserid, message: creatorMessage, seen: false });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
