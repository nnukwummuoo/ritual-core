const PaymentTransaction = require("../../Creators/PaymentTransaction");
const userdb = require("../../Creators/userdb");
const mongoose = require("mongoose");

/**
 * @desc Get all transactions for admin
 * @route GET /api/admin/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    // Build query
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'txData.fromAddress': { $regex: search, $options: 'i' } },
        { 'txData.expectedFromAddress': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get transactions with pagination
    const transactions = await PaymentTransaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get unique user IDs from transactions (as strings for deduplication)
    const userIdStrings = [...new Set(transactions.map(t => {
      if (!t.userId) return null;
      return t.userId.toString();
    }).filter(Boolean))];
    
    // Convert to ObjectIds for the query
    const userIds = userIdStrings
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    
    // Fetch all users to get usernames
    const users = userIds.length > 0 
      ? await userdb.find({ _id: { $in: userIds } }).select('_id username').lean()
      : [];
    
    // Create a map of userId to username
    const usernameMap = {};
    users.forEach(user => {
      usernameMap[user._id.toString()] = user.username || 'N/A';
    });
    
    // Map transactions to include username
    const transactionsWithUsername = transactions.map(transaction => {
      const userIdStr = transaction.userId?.toString() || transaction.userId;
      const username = usernameMap[userIdStr] || 'N/A';
      return {
        ...transaction,
        username: username,
        userId: userIdStr
      };
    });

    // Get total count for pagination
    const totalCount = await PaymentTransaction.countDocuments(query);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Get transaction statistics
    const stats = await PaymentTransaction.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get total revenue
    const revenueStats = await PaymentTransaction.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'finished'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      transactions: transactionsWithUsername,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      stats,
      revenue: revenueStats[0] || { totalRevenue: 0, totalTransactions: 0 }
    });

  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: error.message
    });
  }
};

/**
 * @desc Get transaction by ID
 * @route GET /api/admin/transactions/:id
 */
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID"
      });
    }

    const transaction = await PaymentTransaction.findById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.status(200).json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error("Get transaction by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
      error: error.message
    });
  }
};

/**
 * @desc Update transaction status
 * @route PUT /api/admin/transactions/:id/status
 */
exports.updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID"
      });
    }

    const validStatuses = ['waiting', 'confirming', 'confirmed', 'finished', 'failed', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const transaction = await PaymentTransaction.findByIdAndUpdate(
      id,
      { 
        status,
        $set: {
          'txData.adminNotes': notes,
          'txData.updatedBy': req.userId,
          'txData.updatedAt': new Date()
        }
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction status updated",
      transaction
    });

  } catch (error) {
    console.error("Update transaction status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction status",
      error: error.message
    });
  }
};

/**
 * @desc Get transaction statistics
 * @route GET /api/admin/transactions/stats
 */
exports.getTransactionStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get statistics
    const stats = await PaymentTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Get daily transaction counts
    const dailyStats = await PaymentTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get total revenue
    const revenueStats = await PaymentTransaction.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'finished'] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      period,
      stats,
      dailyStats,
      revenue: revenueStats[0] || { totalRevenue: 0, totalTransactions: 0 }
    });

  } catch (error) {
    console.error("Get transaction stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction statistics",
      error: error.message
    });
  }
};

/**
 * @desc Get revenue by gold pack with month filter
 * @route GET /api/admin/transactions/revenue
 */
exports.getRevenueByGoldPack = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      // new Date(year, month, 0) gives the last day of the previous month (month-1)
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Gold pack prices mapping (from golds array - updated prices)
    const goldPackPrices = {
      6: { gold: 50, bonus: "" },
      10: { gold: 100, bonus: "" },
      20: { gold: 200, bonus: "" },
      36: { gold: 400, bonus: "" },
      66: { gold: 1000, bonus: "" },
      260: { gold: 5000, bonus: "" },
      500: { gold: 10000, bonus: "" },
      950: { gold: 20000, bonus: "" },
      2250: { gold: 50000, bonus: "" },
    };

    // Profit percentage mapping by base gold amount (from the revenue analysis table - updated percentages)
    const profitPercentages = {
      50: 66.67,
      100: 60.00,
      200: 60.00,
      400: 55.56,
      1000: 39.39,
      5000: 23.08,
      10000: 20.00,
      20000: 15.79,
      50000: 11.11,
    };

    // Get only successful transactions (confirmed and finished statuses)
    // This ensures purchase count only includes successful transactions
    const transactions = await PaymentTransaction.find({
      status: { $in: ['confirmed', 'finished'] },
      ...dateFilter
    }).lean();

    // Group transactions by amount and calculate stats
    const revenueByPack = {};
    let totalRevenue = 0;

    transactions.forEach(transaction => {
      const amount = transaction.amount;
      totalRevenue += amount;

      // Round amount to match gold pack prices (handle small floating point differences)
      const roundedAmount = Math.round(amount * 100) / 100;
      
      // Find matching gold pack
      let packKey = null;
      for (const [price, pack] of Object.entries(goldPackPrices)) {
        if (Math.abs(roundedAmount - parseFloat(price)) < 0.01) {
          packKey = price;
          break;
        }
      }

      // If no exact match, use the rounded amount as key
      if (!packKey) {
        packKey = roundedAmount.toString();
      }

      if (!revenueByPack[packKey]) {
        revenueByPack[packKey] = {
          amount: parseFloat(packKey),
          gold: goldPackPrices[packKey]?.gold || null,
          bonus: goldPackPrices[packKey]?.bonus || "",
          purchaseCount: 0,
          totalRevenue: 0
        };
      }

      revenueByPack[packKey].purchaseCount += 1;
      revenueByPack[packKey].totalRevenue += amount;
    });

    // Convert to array and calculate percentages
    const revenueData = Object.values(revenueByPack)
      .map(pack => {
        // Gold amount (no bonus)
        const goldAmount = pack.gold || 0;

        // Calculate total gold (purchase count * gold amount)
        const totalGold = pack.purchaseCount * goldAmount;

        // Get profit percentage for this gold pack
        const profitPercentage = profitPercentages[pack.gold] || 0;

        // Calculate profit: revenue * profit percentage / 100
        const profit = pack.totalRevenue * (profitPercentage / 100);

        return {
          goldAmount: pack.gold ? pack.gold.toString() : pack.amount.toString(),
          purchase: pack.purchaseCount,
          total: totalGold,
          profit: profit,
          revenue: pack.totalRevenue,
          percentage: profitPercentage
        };
      })
      .sort((a, b) => {
        // Sort by gold amount (extract number from string)
        const aGold = parseInt(a.goldAmount) || 0;
        const bGold = parseInt(b.goldAmount) || 0;
        return bGold - aGold; // Descending order
      });

    res.status(200).json({
      success: true,
      month: month || null,
      year: year || null,
      totalRevenue,
      revenueData
    });

  } catch (error) {
    console.error("Get revenue by gold pack error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue data",
      error: error.message
    });
  }
};
