const express = require("express");
const router = express.Router();
const verifyJwt = require("../../../Middleware/verify");
const forceLogoutAll = require("../../../Controller/Admin/forceLogoutAll");

router.route("/").post(verifyJwt, forceLogoutAll);

module.exports = router;