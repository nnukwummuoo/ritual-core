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

module.exports = router;
