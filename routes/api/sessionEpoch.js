const express = require("express");
const router = express.Router();
const { getSessionEpoch } = require("../../utiils/sessionEpoch");

router.get("/", async (req, res) => {
  try {
    const epoch = await getSessionEpoch();
    return res.status(200).json({ epoch });
  } catch (err) {
    console.error("❌ Session epoch check error:", err);
    return res.status(500).json({ epoch: 0 });
  }
});

module.exports = router;