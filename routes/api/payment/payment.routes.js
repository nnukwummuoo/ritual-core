const express = require("express");
const router = express.Router();
const verifyJwt = require("../../../Middleware/verify");
const { savePaymentAccount, checkIfPaymentAccountExists, deletePaymentAccount, verifyWalletSignature } = require("../../../Controller/accountPayment/payment.conroller");

router.post("/", verifyJwt, savePaymentAccount);
router.get("/check-account/:userId", checkIfPaymentAccountExists);
router.delete("/:userId", verifyJwt, deletePaymentAccount);
router.post("/verify-wallet", verifyJwt, verifyWalletSignature);

module.exports = router;