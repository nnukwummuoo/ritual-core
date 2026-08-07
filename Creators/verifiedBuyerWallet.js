const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true },
  verifiedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("VerifiedBuyerWallet", schema);