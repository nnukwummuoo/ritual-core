const PaymentAccount = require("../../Creators/paymentAccount");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
const VerifiedBuyerWallet = require("../../Creators/verifiedBuyerWallet");

/**
 * Verifies that the person submitting this request actually controls the
 * wallet address they claim to — by checking a signed message against it.
 * A correct signature is cryptographic proof of control; nothing else here
 * (format checks, checksum checks) can provide that.
 */
exports.verifyWalletSignature = async (req, res) => {
  try {
    const { address, message, signature } = req.body;

    if (!address || !message || !signature) {
      return res.status(400).json({ ok: false, message: "Missing address, message, or signature" });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ ok: false, message: "Invalid address format" });
    }

    // Recover the address that actually produced this signature
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (err) {
      return res.status(400).json({ ok: false, message: "Could not verify signature" });
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ ok: false, message: "Signature does not match the provided address" });
    }

    return res.status(200).json({ ok: true, verifiedAddress: recoveredAddress });
  } catch (error) {
    console.error("❌ verifyWalletSignature error:", error);
    return res.status(500).json({ ok: false, message: "Something went wrong verifying your wallet" });
  }
};

/**
 * Verifies + persists the wallet a user will be sending FROM when buying Gold.
 * Same signature-verification core as the payout flow, different purpose and
 * a different, lightweight collection — this one just remembers one address
 * per user so they don't have to reconnect/re-sign on every purchase.
 */
exports.saveVerifiedBuyerWallet = async (req, res) => {
  try {
    const userId = req.userId;
    const { address, message, signature } = req.body;

    if (!address || !message || !signature) {
      return res.status(400).json({ ok: false, message: "Missing address, message, or signature" });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ ok: false, message: "Invalid address format" });
    }

    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(400).json({ ok: false, message: "Could not verify signature" });
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ ok: false, message: "Signature does not match the provided address" });
    }

    await VerifiedBuyerWallet.findOneAndUpdate(
      { userId },
      { walletAddress: recoveredAddress, verifiedAt: new Date() },
      { upsert: true, new: true }
    );

    return res.status(200).json({ ok: true, walletAddress: recoveredAddress });
  } catch (error) {
    console.error("❌ saveVerifiedBuyerWallet error:", error);
    return res.status(500).json({ ok: false, message: "Something went wrong" });
  }
};

exports.getVerifiedBuyerWallet = async (req, res) => {
  try {
    const userId = req.userId;
    const record = await VerifiedBuyerWallet.findOne({ userId });
    return res.status(200).json({ ok: true, walletAddress: record?.walletAddress || null });
  } catch (error) {
    console.error("❌ getVerifiedBuyerWallet error:", error);
    return res.status(500).json({ ok: false, message: "Something went wrong" });
  }
};

exports.deleteVerifiedBuyerWallet = async (req, res) => {
  try {
    const userId = req.userId;
    await VerifiedBuyerWallet.deleteOne({ userId });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("❌ deleteVerifiedBuyerWallet error:", error);
    return res.status(500).json({ ok: false, message: "Something went wrong" });
  }
};

exports.savePaymentAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const { method, fullName, email, phone, country, currency, cryptoType, walletAddress } = req.body;

    // Validate required fields per the pattern
    if (!method || !fullName || !country || !walletAddress) {
      return res.status(400).json({
        message: "Missing required fields: method, fullName, country, or walletAddress",
      });
    }

    const VALID_CURRENCIES = ["USDT (BEP-20)", "USDC (BEP-20)"];
    if (!currency || !VALID_CURRENCIES.includes(currency)) {
      return res.status(400).json({ message: "Please select a stable coin (USDT or USDC)." });
    }

    // Validate method
    if (method !== "crypto") {
      return res.status(400).json({ message: "Only cryptocurrency accounts are supported" });
    }

    // Check if user already has a crypto account
    const existing = await PaymentAccount.findOne({ userId, method });
    if (existing) {
      return res.status(400).json({ message: "You have already added a cryptocurrency account." });
    }

    // Basic wallet address validation - check if it starts with 0x and is 42 characters
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      return res.status(400).json({ message: "Invalid wallet address format. Must start with 0x and be 42 characters long." });
    }
    
    // Check if remaining characters are valid hexadecimal
    const hexPattern = /^0x[0-9a-fA-F]{40}$/;
    if (!hexPattern.test(walletAddress)) {
      return res.status(400).json({ message: "Invalid wallet address. Must contain only valid hexadecimal characters after 0x." });
    }

    // Prepare account data
    const accountData = {
      userId,
      method: "crypto",
      fullName,
      email,
      phone,
      country,
      currency,
      cryptoType: cryptoType || "USDT_BEP20", // Default to USDT_BEP20 if not provided
      walletAddress,
    };

    // Save new payment method
    const saved = await PaymentAccount.create(accountData);

    return res.status(201).json({ message: "Account saved", data: saved });
  } catch (err) {
    console.error("Error saving account:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.checkIfPaymentAccountExists = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    const account = await PaymentAccount.findOne({ userId });

    if (!account) {
      return res.status(404).json({ exists: false, message: "No payment account found" });
    }

    return res.status(200).json({ exists: true, account });
  } catch (err) {
    console.error("Check account error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.deletePaymentAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    const deleted = await PaymentAccount.findOneAndDelete({ userId });

    if (!deleted) {
      return res.status(404).json({ message: "No payment account found to delete" });
    }

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ message: "Server error while deleting account" });
  }
};