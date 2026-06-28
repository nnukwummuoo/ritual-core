const express = require("express");
const router = express.Router();
const processExpiredRequests = require("../../scripts/processExpiredRequests");

router.post("/", async (req, res) => {
  await processExpiredRequests(req, res);
});

module.exports = router;