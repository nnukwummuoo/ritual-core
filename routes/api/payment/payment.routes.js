const express = require("express");
const router = express.Router();
const verifyJwt = require("../../../Middleware/verify");
const {
  savePaymentAccount,
  checkIfPaymentAccountExists,
  deletePaymentAccount,
  verifyWalletSignature,
  saveVerifiedBuyerWallet,
  getVerifiedBuyerWallet,
  deleteVerifiedBuyerWallet,
} = require("../../../Controller/accountPayment/payment.conroller");

router.post("/", verifyJwt, savePaymentAccount);
router.get("/check-account/:userId", checkIfPaymentAccountExists);
router.delete("/:userId", verifyJwt, deletePaymentAccount);
router.post("/verify-wallet", verifyJwt, verifyWalletSignature);
router.post("/verify-buyer-wallet", verifyJwt, saveVerifiedBuyerWallet);
router.get("/buyer-wallet", verifyJwt, getVerifiedBuyerWallet);
router.delete("/buyer-wallet", verifyJwt, deleteVerifiedBuyerWallet);

module.exports = router;