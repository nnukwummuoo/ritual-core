const express = require("express");
const router = express.Router();
const { controller } = require("../../scripts/processExpiredRequests");

router.post("/", async (req, res) => {
  await controller(req, res);
});

module.exports = router;