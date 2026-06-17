const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const historydb = require("../../Creators/mainbalance");
const admindb = require("../../Creators/admindb");
let sendEmail = require("../../utiils/sendEmailnot");
let { pushActivityNotification } = require("../../utiils/sendPushnot");

const createFanRequest = async (req, res) => {
  const {
    userid,
    creator_portfolio_id,
    type,
    time,
    place,
    date,
    price
  } = req.body;

  if (!creator_portfolio_id || !userid) {
    return res.status(400).json({
      ok: false,
      message: "User ID or Creator ID invalid!!"
    });
  }

  try {
    // Get user and creator data
    const user = await userdb.findOne({ _id: userid }).exec();
    const creator = await creatordb.findOne({ _id: creator_portfolio_id }).exec();

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User not found"
      });
    }

    if (!creator) {
      return res.status(404).json({
        ok: false,
        message: "Creator not found"
      });
    }

    // Check user balance
    let userBalance = parseFloat(user.balance) || 0;
    let userPending = parseFloat(user.pending) || 0;
    let creatorPrice = parseFloat(price);

    if (userBalance < creatorPrice) {
      return res.status(400).json({
        ok: false,
        message: "Insufficient balance!!"
      });
    }

    // Deduct from balance and add to pending
    let newBalance = userBalance - creatorPrice;
    let newPending = userPending + creatorPrice;

    // Update user balance and pending
    user.balance = String(newBalance);
    user.pending = String(newPending);
    await user.save();

    // Create transaction history
    const clientHistory = {
      userid,
      details: "Fan meet request - amount moved to pending",
      spent: `${creatorPrice}`,
      income: "0",
      date: `${Date.now().toString()}`
    };
    await historydb.create(clientHistory);

    // Calculate expiration based on type: 7 days for Fan Call, 20 days for others
    const isFanCall = (type || "").toLowerCase().includes("fan call");
    const expirationDays = isFanCall ? 10 : 20;

    // Create request record
    const requestData = {
      userid,
      creator_portfolio_id,
      type,
      place,
      time,
      status: "request",
      date,
      price: creatorPrice,
      expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
    };

    const request = await requestdb.create(requestData);

    // Get host type for dynamic messages
    const hostType = type || "Fan meet";

    // Send notifications
    await sendEmail(creator.userid, `New ${hostType.toLowerCase()} request received`);
    await pushActivityNotification(creator.userid, `New ${hostType.toLowerCase()} request received`, "request_request");

    // Create database notification for creator
    await admindb.create({
      userid: creator.userid,
      message: `New ${hostType.toLowerCase()} request from ${user.firstname} ${user.lastname}`,
      seen: false
    });

    await sendEmail(userid, `${hostType} request sent successfully`);
    await pushActivityNotification(userid, `${hostType} request sent successfully`, "request_request");

    // Create database notification for fan
    await admindb.create({
      userid: userid,
      message: `${hostType} request sent to ${creator.firstname} ${creator.lastname}`,
      seen: false
    });

    return res.status(200).json({
      ok: true,
      message: `${hostType} request created successfully`,
      requestId: request._id
    });

  } catch (err) {
    console.error("Error creating fan meet request:", err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`
    });
  }
};

module.exports = createFanRequest;
