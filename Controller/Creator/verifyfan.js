let userdb = require("../../Creators/userdb");
let documentdb = require("../../Creators/document");
let admindb = require("../../Creators/admindb");
const { pushAdminNotification } = require("../../utiils/sendPushnot");

const verifyFan = async (req, res) => {
  const { userid, docid } = req.body;

  if (!userid || !docid) {
    return res.status(400).json({ ok: false, message: "User ID or document ID invalid!" });
  }

  try {
    // 1. Update user fan verification fields
    const user = await userdb.findById(userid).exec();
    if (!user) return res.status(404).json({ ok: false, message: "User not found!" });

    user.fan_verified = true;
user.fan_application_status = "accepted";
await user.save();
console.log("✅ saved fan status:", user.fan_verified, user.fan_application_status); // ADD THIS

    // 2. Update document verify field
    const document = await documentdb.findById(docid).exec();
    if (document) {
      document.verify = true;
      await document.save();
    }

    // 3. Save admin notification to DB
    await admindb.create({
      userid,
      message: `Your fan verification is approved — welcome to verified fan status!`,
      seen: false,
    });

    // 4. Send push notification
    try {
      await pushAdminNotification(
        userid,
        `🎉 Your fan verification is approved — welcome to verified fan status!`,
        "fan_verification_approved"
      );
    } catch (pushError) {
      console.error("Error sending push notification:", pushError);
    }

    return res.status(200).json({
      ok: true,
      message: "Fan verified successfully",
      docid,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = verifyFan;