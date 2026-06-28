const express = require("express");
const router = express.Router();
const { controller } = require("../../Controller/request/processExpiredRequests");


router.post("/", async (req, res) => {
  await controller(req, res);
});

module.exports = router;