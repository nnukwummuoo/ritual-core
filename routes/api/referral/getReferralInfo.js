const express = require("express");
const router = express.Router();
const getReferralInfo = require("../../../Controller/Referral/getReferralInfo");
const transferReferralReward = require("../../../Controller/Referral/transferReferralReward");
const verifyJWT = require("../../../Middleware/verify");

router.get("/", verifyJWT, getReferralInfo);
router.post("/transfer", verifyJWT, transferReferralReward);

module.exports = router;
