const fetch = require('node-fetch');
const { ethers } = require("ethers");
const dotenv = require("dotenv");
const PaymentTransaction = require("../../Creators/PaymentTransaction");
const userdb = require("../../Creators/userdb");
const mainbalance = require("../../Creators/mainbalance");

dotenv.config();

// ==================== ENV CONFIG ====================
// Use multiple reliable BSC RPC URLs as fallbacks
const RPC_URLS = [
  process.env.RPC_URL,
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://bsc-dataseed.binance.org/",
  "https://bsc-mainnet.rpcfast.com?api_key=xbhWBI1Wkguk8SNMu1bvvLurPGLXmgwYeC4S6g2H7WdwFigZSmPWVZRxrskEQwIf"
].filter(Boolean);

const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
// ==================================================

// Setup blockchain connection
let provider;
let contract;

// Initialize Web3 connection with fallback
const initializeWeb3 = async () => {
  for (let i = 0; i < RPC_URLS.length; i++) {
    try {
      console.log(`🔗 Trying RPC URL ${i + 1}: ${RPC_URLS[i].substring(0, 50)}...`);
      provider = new ethers.JsonRpcProvider(RPC_URLS[i]);
      
      // Test the connection
      await provider.getNetwork();
      console.log(`✅ RPC connection successful with URL ${i + 1}`);
      
      const abi = [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "function balanceOf(address owner) view returns (uint256)"
      ];
      contract = new ethers.Contract(USDT_CONTRACT, abi, provider);
      console.log("✅ Web3 connection initialized");
      return true;
    } catch (error) {
      console.error(`❌ RPC URL ${i + 1} failed: ${error.message}`);
      continue;
    }
  }
  
  console.error("❌ All RPC URLs failed. Web3 initialization failed.");
  return false;
};

// Initialize on module load
initializeWeb3();

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if transaction hash already exists in database (duplicate protection)
 */
const checkDuplicateTransaction = async (txHash) => {
  try {
    // Check if this transaction hash already exists in any confirmed transaction
    const existingTransaction = await PaymentTransaction.findOne({
      "txData.txHash": txHash,
      status: "confirmed"
    });

    if (existingTransaction) {
      console.log(`⚠️ [DUPLICATE] Transaction hash ${txHash} already used for order: ${existingTransaction.orderId}`);
      return {
        isDuplicate: true,
        existingOrderId: existingTransaction.orderId,
        existingUserId: existingTransaction.userId,
        existingAmount: existingTransaction.amount
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error("❌ Error checking duplicate transaction:", error);
    return { isDuplicate: false, error: error.message };
  }
};

/**
 * Verify transaction hash using reliable methods
 */
const verifyTransactionHash = async (txHash, expectedAmount = null) => {
  try {
    const API_KEY = process.env.ETHERSCAN_API_KEY; 
    
    if (!API_KEY) {
      console.error("❌ [API FAIL] BscScan API Key not configured.");
      return { valid: false, error: "API key not configured" };
    }

    // Validate hash format
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return { valid: false, error: "Invalid transaction hash format" };
    }

    console.log(`🔍 [VERIFICATION] Starting verification for TX: ${txHash}`);

    // 1. Check for duplicate transaction first
    console.log(`🔍 [DUPLICATE CHECK] Checking if transaction hash already exists...`);
    const duplicateCheck = await checkDuplicateTransaction(txHash);
    if (duplicateCheck.isDuplicate) {
      return { 
        valid: false, 
        error: `This transaction hash has already been used for purchase in order ${duplicateCheck.existingOrderId}. Please use a different transaction.`,
        isDuplicate: true
      };
    }
    console.log("✅ [DUPLICATE CHECK] No duplicate found");

    // 2. PRIMARY METHOD: Use direct RPC calls (most reliable)
    console.log(`🔄 [RPC PRIMARY] Using direct RPC verification...`);
    
    let rpcTx, rpcReceipt;
    try {
      if (!provider) {
        await initializeWeb3();
      }
      
      rpcTx = await provider.getTransaction(txHash);
      if (!rpcTx) {
        return { valid: false, error: "Transaction not found via RPC. It may not be confirmed yet." };
      }
      
      rpcReceipt = await provider.getTransactionReceipt(txHash);
      if (!rpcReceipt) {
        return { valid: false, error: "Transaction receipt not available via RPC. Wait for confirmation." };
      }
      
      console.log(`✅ [RPC] Transaction found in block: ${rpcReceipt.blockNumber}`);
      
      // Check transaction status via RPC
      if (rpcReceipt.status !== 1) {
        return { valid: false, error: "Transaction failed on chain." };
      }
      
      console.log("✅ [RPC] Transaction status: success");
      
    } catch (rpcError) {
      console.error(`❌ [RPC FAIL] RPC verification error:`, rpcError.message);
      return { valid: false, error: `RPC verification failed: ${rpcError.message}` };
    }

    // 3. PARSE TRANSFER DETAILS FROM RECEIPT LOGS
    let usdtAmount = 0;
    let fromAddress = null;
    let foundMyTransfer = false;
    
    console.log("🔎 [LOGS] Parsing transaction logs...");
    console.log(`🔎 [LOGS] Target Wallet: ${WALLET_ADDRESS?.toLowerCase()}`);

    if (rpcReceipt.logs && rpcReceipt.logs.length > 0) {
      console.log(`📝 [LOGS] Found ${rpcReceipt.logs.length} logs`);
      
      for (const log of rpcReceipt.logs) {
        // Check if log is from USDT contract
        if (log.address.toLowerCase() === USDT_CONTRACT.toLowerCase()) {
          console.log("⚠️ [LOGS] Found USDT contract log");
          
          try {
            // Parse Transfer event
            if (log.topics && log.topics.length === 3) {
              const eventSignature = log.topics[0];
              const fromTopic = log.topics[1];
              const toTopic = log.topics[2];
              
              // Check if this is a Transfer event
              const transferEventSignature = ethers.keccak256(ethers.toUtf8Bytes("Transfer(address,address,uint256)"));
              if (eventSignature !== transferEventSignature) {
                console.log("⚠️ [LOGS] Not a Transfer event, skipping");
                continue;
              }
              
              // Extract to address
              const toAddr = ethers.getAddress("0x" + toTopic.slice(26));
              console.log(`⚠️ [LOGS] Transfer to: ${toAddr}`);
              
              // Check if transfer is to our wallet
              if (toAddr.toLowerCase() === WALLET_ADDRESS?.toLowerCase()) {
                // Parse amount from data
                const valueHex = log.data;
                const valueBigInt = BigInt(valueHex);
                usdtAmount = Number(valueBigInt) / 1e18; // USDT has 18 decimals
                
                // Extract from address
                fromAddress = ethers.getAddress("0x" + fromTopic.slice(26));
                foundMyTransfer = true;
                
                console.log(`✅ [LOGS] Found USDT transfer: ${usdtAmount} USDT from ${fromAddress}`);
                break;
              }
            }
          } catch (logError) {
            console.error("❌ [LOGS] Error parsing log:", logError);
          }
        }
      }
    }

    // Alternative: Check for BNB transfer
    if (!foundMyTransfer && rpcTx && rpcTx.to) {
      if (rpcTx.to.toLowerCase() === WALLET_ADDRESS?.toLowerCase()) {
        console.log("⚠️ [LOGS] Found BNB transfer to wallet");
        usdtAmount = Number(ethers.formatEther(rpcTx.value || "0"));
        fromAddress = rpcTx.from;
        foundMyTransfer = true;
        console.log(`✅ [LOGS] Found BNB transfer: ${usdtAmount} BNB from ${fromAddress}`);
      }
    }

    if (!foundMyTransfer) {
      console.error("❌ [LOGS] No transfer found to target wallet");
      return { valid: false, error: "Transaction is valid, but no funds were sent to YOUR wallet address." };
    }

    // 4. VERIFY AMOUNT
    console.log(`💰 [AMOUNT] Received: ${usdtAmount}, Expected: ${expectedAmount || 'N/A'}`);

    if (expectedAmount !== null) {
      const tolerance = 0.2;
      const diff = Math.abs(usdtAmount - expectedAmount);

      if (diff > tolerance) {
        if (usdtAmount < expectedAmount) {
          return { valid: false, error: `Amount mismatch. Received ${usdtAmount}, expected ${expectedAmount}.` };
        }
        console.log(`⚠️ Overpayment detected: ${usdtAmount} vs ${expectedAmount}. Accepting.`);
      }
    }
    
    console.log("🎉 [SUCCESS] All verification checks passed.");

    // Get block timestamp
    let timestamp = Date.now();
    try {
      const block = await provider.getBlock(rpcReceipt.blockNumber);
      if (block && block.timestamp) {
        timestamp = block.timestamp * 1000;
      }
    } catch (blockError) {
      console.warn("⚠️ Could not get block timestamp:", blockError.message);
    }

    return {
      valid: true,
      amount: usdtAmount,
      fromAddress: fromAddress,
      toAddress: WALLET_ADDRESS,
      txHash: txHash,
      blockNumber: rpcReceipt.blockNumber,
      timestamp: timestamp
    };

  } catch (error) {
    console.error(`💥 [GLOBAL ERROR] Exception in verifyTransactionHash: ${error.message}`);
    return { valid: false, error: `Verification failed: ${error.message}` };
  }
};

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * @desc Create a Web3 payment request
 */
exports.createWeb3Payment = async (req, res) => {
  try {
    const { amount, userId, order_description, fromAddress } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({ message: "Missing required fields: amount, userId" });
    }

    if (!fromAddress || !/^0x[a-fA-F0-9]{40}$/.test(fromAddress)) {
      return res.status(400).json({ message: "A valid sending wallet address is required." });
    }

    if (!WALLET_ADDRESS) {
      return res.status(500).json({ message: "Wallet address not configured" });
    }

    const orderId = `web3_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    const newTx = new PaymentTransaction({
      userId,
      orderId,
      amount: Number(amount),
      payCurrency: "USDT_BEP20",
      description: order_description || "Gold Pack Purchase",
      status: "waiting",
      expiresAt: expiresAt,
      txData: {
        type: "web3_payment",
        contractAddress: USDT_CONTRACT,
        network: "BSC",
        walletAddress: WALLET_ADDRESS,
        paymentMethod: "web3",
        expectedFromAddress: fromAddress.toLowerCase()
      }
    });

    await newTx.save();

    res.status(200).json({
      message: "Web3 payment created",
      orderId,
      walletAddress: WALLET_ADDRESS,
      amount: Number(amount),
      currency: "USDT",
      network: "BSC",
      contractAddress: USDT_CONTRACT,
      expiresAt: expiresAt,
      instructions: `Send exactly ${amount} USDT (BEP20) to the wallet address above.`
    });

  } catch (error) {
    console.error("Web3 payment creation error:", error);
    res.status(500).json({ message: "Web3 payment creation failed", error: error.message });
  }
};

/**
 * @desc Check payment status by order ID
 */
exports.checkWeb3PaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) return res.status(400).json({ message: "Order ID is required" });

    const transaction = await PaymentTransaction.findOne({ orderId });

    if (!transaction) return res.status(404).json({ message: "Transaction not found" });

    // Auto-expire if waiting too long
    if (transaction.expiresAt && new Date() > transaction.expiresAt && transaction.status === 'waiting') {
      transaction.status = 'expired';
      await transaction.save();
    }

    res.status(200).json({
      orderId: transaction.orderId,
      status: transaction.status,
      amount: transaction.amount,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      expiresAt: transaction.expiresAt,
      txData: transaction.txData
    });

  } catch (error) {
    console.error(`Error checking status:`, error);
    res.status(500).json({ message: "Failed to check payment status", error: error.message });
  }
};

/**
 * @desc Verify transaction hash and confirm payment
 */
exports.verifyTransactionHash = async (req, res) => {
  try {
    const { orderId, txHash } = req.body;

    if (!orderId || !txHash) return res.status(400).json({ message: "Missing fields: orderId, txHash" });

    const transaction = await PaymentTransaction.findOne({ orderId });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });

    if (transaction.status === 'confirmed') return res.status(200).json({ message: "Already confirmed", status: "confirmed" });
    
    if (transaction.expiresAt && new Date() > transaction.expiresAt) {
       transaction.status = 'expired';
       await transaction.save();
       return res.status(400).json({ message: "Payment expired", status: "expired" });
    }

    // EXECUTE VERIFICATION
    const verification = await verifyTransactionHash(txHash, transaction.amount);

    if (verification.valid) {
      const expectedFrom = transaction.txData?.expectedFromAddress;
      if (expectedFrom && verification.fromAddress?.toLowerCase() !== expectedFrom.toLowerCase()) {
        return res.status(400).json({
          message: "This transaction was not sent from the wallet address registered for this order.",
          status: "sender_mismatch",
        });
      }
    }

    if (!verification.valid) {
      // Check if it's a duplicate transaction error
      if (verification.isDuplicate) {
        return res.status(400).json({ 
          message: verification.error, 
          status: "duplicate_transaction",
          details: verification.error
        });
      }
      
      return res.status(400).json({ 
        message: verification.error, 
        status: "verification_failed",
        details: verification.error
      });
    }

    // Success: Update Transaction
    transaction.status = "confirmed";
    transaction.txData = {
      ...transaction.txData,
      amount: verification.amount,
      txHash: verification.txHash,
      fromAddress: verification.fromAddress,
      confirmedAt: new Date(),
      verifiedVia: "RPC_DIRECT"
    };
    await transaction.save();

    // Credit User Gold
    const goldAmount = await getGoldAmountFromTransaction(transaction);
    await creditUserGold(transaction.userId, goldAmount);

    res.status(200).json({
      message: "Payment verified successfully",
      status: "confirmed",
      orderId: transaction.orderId,
      amount: verification.amount,
      goldAmount: goldAmount
    });

  } catch (error) {
    console.error(`Verification failed for ${req.body.orderId}:`, error);
    res.status(500).json({ message: "Transaction verification failed", error: error.message });
  }
};

/**
 * @desc Get user's USDT balance from blockchain
 */
exports.getWalletBalance = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!contract) {
      await initializeWeb3();
      if (!contract) return res.status(500).json({ message: "Web3 not initialized" });
    }

    const balance = await contract.balanceOf(walletAddress);
    const balanceInUSDT = Number(ethers.formatUnits(balance, 18));

    res.status(200).json({
      walletAddress,
      balance: balanceInUSDT,
      currency: "USDT",
      network: "BSC"
    });

  } catch (error) {
    console.error("Get wallet balance error:", error);
    res.status(500).json({ message: "Failed to get wallet balance", error: error.message });
  }
};

/**
 * @desc Check if transaction hash is already used
 */
exports.checkTransactionHash = async (req, res) => {
  try {
    const { txHash } = req.params;

    if (!txHash) return res.status(400).json({ message: "Transaction hash is required" });

    const duplicateCheck = await checkDuplicateTransaction(txHash);

    if (duplicateCheck.isDuplicate) {
      return res.status(200).json({
        exists: true,
        message: `This transaction hash has already been used for purchase in order ${duplicateCheck.existingOrderId}`,
        existingOrderId: duplicateCheck.existingOrderId,
        existingUserId: duplicateCheck.existingUserId,
        existingAmount: duplicateCheck.existingAmount
      });
    }

    return res.status(200).json({
      exists: false,
      message: "Transaction hash is available for use"
    });

  } catch (error) {
    console.error("Error checking transaction hash:", error);
    res.status(500).json({ message: "Failed to check transaction hash", error: error.message });
  }
};

/**
 * @desc Process expired payments (cron job)
 */
exports.processExpiredPayments = async () => {
  try {
    console.log(`🕐 [CRON] Checking for expired payments...`);
    
    const expiredPayments = await PaymentTransaction.find({
      status: "waiting",
      expiresAt: { $lt: new Date() }
    });

    if (expiredPayments.length === 0) return { processed: 0 };

    let processedCount = 0;
    for (const payment of expiredPayments) {
      try {
        payment.status = "expired";
        await payment.save();
        processedCount++;
      } catch (error) {
        console.error(`❌ [CRON] Error expiring payment ${payment.orderId}:`, error);
      }
    }

    return { processed: processedCount };

  } catch (error) {
    console.error(`❌ [CRON] Error processing expired payments:`, error);
    return { processed: 0, error: error.message };
  }
};

/**
 * @desc Manual trigger for processing expired payments
 */
exports.manualProcessExpired = async (req, res) => {
  try {
    const result = await exports.processExpiredPayments();
    res.status(200).json({ message: "Expired payments processed", ...result });
  } catch (error) {
    res.status(500).json({ message: "Failed to process expired payments", error: error.message });
  }
};

/**
 * @desc Cancel a Web3 payment
 */
exports.cancelWeb3Payment = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ message: "Order ID is required" });

    const transaction = await PaymentTransaction.findOne({ orderId });
    
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });

    if (['confirmed', 'finished'].includes(transaction.status)) {
      return res.status(400).json({ message: "Cannot cancel confirmed transaction" });
    }

    if (['failed', 'expired', 'cancelled'].includes(transaction.status)) {
      return res.status(400).json({ message: "Transaction is already cancelled or expired" });
    }

    transaction.status = 'cancelled';
    transaction.updatedAt = new Date();
    await transaction.save();

    res.status(200).json({ message: "Transaction cancelled", status: "cancelled" });

  } catch (error) {
    res.status(500).json({ message: "Cancellation failed", error: error.message });
  }
};

// ==================== HELPERS ====================

const getGoldAmountFromTransaction = async (transaction) => {
  try {
    const description = transaction.description || "";
    const goldMatch = description.match(/(\d+)\s+Gold/i);
    if (goldMatch) return parseInt(goldMatch[1]);
    return Math.floor(transaction.amount);
  } catch (error) {
    return Math.floor(transaction.amount);
  }
};

const creditUserGold = async (userId, goldAmount) => {
  try {
    console.log(`💰 Crediting ${goldAmount} gold to user ${userId}`);
    
    // Use the UserDB model to update balance (not coinBalance)
    const user = await userdb.findById(userId);
    
    if (user) {
      // Update balance field (string type)
      const currentBalance = parseFloat(user.balance) || 0;
      const newBalance = currentBalance + goldAmount;
      user.balance = newBalance.toString();
      
      await user.save();
      console.log(`✅ Successfully credited ${goldAmount} gold to user ${userId}. New balance: ${user.balance}`);
    } else {
      console.error(`❌ User not found with id: ${userId}`);
      return false;
    }
    
    // Optional: Also record in balance history if needed
    try {
      await mainbalance.create({
        userid: userId,
        details: `Gold purchase: ${goldAmount} gold`,
        income: goldAmount.toString(),
        date: new Date().toISOString(),
      });
      console.log(`📝 Recorded gold purchase in balance history for user ${userId}`);
    } catch (historyError) {
      console.warn(`⚠️ Could not record in balance history: ${historyError.message}`);
      // Don't fail the whole operation if history recording fails
    }
    
    return true;
  } catch (error) {
    console.error("❌ Error crediting gold:", error);
    return false;
  }
};

/**
 * Initialize Web3 listener
 */
exports.initializeWeb3Listener = async () => {
  try {
    if (!WALLET_ADDRESS) {
      console.error("❌ WALLET_ADDRESS not configured");
      return false;
    }
    
    const success = await initializeWeb3();
    if (success) {
      console.log("✅ Web3 connection ready");
      return true;
    } else {
      console.error("❌ Failed to initialize Web3");
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to initialize Web3:", error);
    return false;
  }
};