const express = require("express");
const router = express.Router();
const ppvController = require("../../../Controller/PPV/PPVController");
const verifyJWT = require("../../../Middleware/verify");

// User Settings (verified creators only, checked in the controller)
router.put("/settings", verifyJWT, ppvController.updatePPVSettings);

// Unlock Message
router.post("/unlock-message", verifyJWT, ppvController.unlockMessage);

module.exports = router;
