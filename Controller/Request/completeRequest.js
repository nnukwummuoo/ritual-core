const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");

// Socket.io integration
const { emitFanRequestStatusUpdate } = require('../../utils/socket');

const completeRequest = async (req, res) => {
  const {
    requestId,
    userid,
    creator_portfolio_id
  } = req.body;
  

  if (!requestId || !userid || !creator_portfolio_id) {
    return res.status(400).json({
      ok: false,
      message: "Missing required parameters"
    });
  }

  try {
    // Find the request
    const request = await requestdb.findOne({ 
      _id: requestId,
      userid: userid,
      creator_portfolio_id: creator_portfolio_id,
      status: "accepted"
    }).exec();

    if (!request) {
      return res.status(404).json({
        ok: false,
        message: "Accepted Request not found"
      });
    }

    // Update request status to completed
    request.status = "completed";
    await request.save();

    // Get host type from request first, then fallback to creator profile
    let creatorProfile = await creatordb.findOne({ userid: creator_portfolio_id }).exec();
    if (!creatorProfile) {
      // If not found by userid, try by _id (in case creator_portfolio_id is the profile ID)
      creatorProfile = await creatordb.findOne({ _id: creator_portfolio_id }).exec();
    }
    const hostType = request.type || creatorProfile?.hosttype || "Fan request";

    // Emit socket event for real-time updates
    emitFanRequestStatusUpdate({
      requestId: request._id,
      status: 'completed',
      userid: userid,
      creator_portfolio_id: creator_portfolio_id,
      message: `✅ ${hostType} has been completed!`
    });

    // Transfer money from user's pending to creator's balance
    const user = await userdb.findOne({ _id: userid }).exec();
    
    // Find creator by hostid first, then by userid
    let creator = await userdb.findOne({ _id: creator_portfolio_id }).exec();
    if (!creator) {
      // If not found by _id, try to find by creator_portfolio_id (hostid) in creatordb
      const creatorRecord = await creatordb.findOne({ _id: creator_portfolio_id }).exec();
      if (creatorRecord) {
        creator = await userdb.findOne({ _id: creatorRecord.userid }).exec();
      }
    }

    // Use the host type already fetched above

    if (user && creator) {
      let userPending = parseFloat(user.pending) || 0;
      let creatorEarnings = parseFloat(creator.earnings) || 0;
      let transferAmount = parseFloat(request.price);

      // Deduct from user's pending
      user.pending = String(userPending - transferAmount);
      await user.save();

      // Add to creator's earnings only (not balance)
      creator.earnings = String(creatorEarnings + transferAmount);
      await creator.save();

      // Create transaction histories
      const userHistory = {
        userid,
        details: `${hostType} completed - payment transferred to creator`,
        spent: `${transferAmount}`,
        income: "0",
        date: `${Date.now().toString()}`
      };
      await historydb.create(userHistory);

      const creatorHistory = {
        userid: creator._id, // Use the actual creator's user ID, not the host ID
        details: `${hostType} completed - payment received`,
        spent: "0",
        income: `${transferAmount}`,
        date: `${Date.now().toString()}`
      };
      await historydb.create(creatorHistory);
    }

    // Send notifications
    await sendEmail(userid, `${hostType} completed successfully!`);
    await pushActivityNotification(userid, `${hostType} completed successfully!`, "request_completed");
    
    // Create database notification for fan
    await admindb.create({
      userid: userid,
      message: `${hostType} completed successfully!`,
      seen: false
    });
    
    // Send notification to creator's actual user ID, not portfolio ID
    if (creator && creator._id) {
      await sendEmail(creator._id, `${hostType} completed - payment received!`);
      await pushActivityNotification(creator._id, `${hostType} completed - payment received!`, "request_completed");
      
      // Create database notification for creator
      await admindb.create({
        userid: creator._id,
        message: `${hostType} completed - payment received!`,
        seen: false
      });
    }

    return res.status(200).json({
      ok: true,
      message: `${hostType} completed successfully`
    });

  } catch (err) {
    console.error("Error completing fan request:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = completeRequest;
