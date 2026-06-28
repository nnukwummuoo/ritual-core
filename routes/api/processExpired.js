const express = require("express");
const router = express.Router();
const { controller } = require("../../Controller/Request/processExpiredRequests");


router.post("/", async (req, res) => {
  await controller(req, res);
});

module.exports = router;