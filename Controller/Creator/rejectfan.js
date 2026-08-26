let userdb = require("../../Creators/userdb");
let documentdb = require("../../Creators/document");
let admindb = require("../../Creators/admindb");
const { pushAdminNotification } = require("../../utiils/sendPushnot");

const rejectFan = async (req, res) => {
  const { userid, docid } = req.body;

  if (!userid || !docid) {
    return res.status(400).json({ ok: false, message: "User ID or document ID invalid!" });
  }

  try {
    // 1. Update user fan status
    const user = await userdb.findById(userid).exec();
    if (!user) return res.status(404).json({ ok: false, message: "User not found!" });

    user.fan_verified = false;
    user.fan_application_status = "rejected";
    await user.save();

    // 2. Delete the document so they can resubmit
    await documentdb.findByIdAndDelete(docid).exec();

    // 3. Save admin notification
    await admindb.create({
      userid,
      message: `Your fan verification was not approved. Please review your details and try again.`,
      seen: false,
    });

    // 4. Push notification
    try {
      await pushAdminNotification(
        userid,
        `❌ Your fan verification was not approved. Please review your details and try again.`,
        "fan_verification_rejected"
      );
    } catch (pushError) {
      console.error("Error sending push notification:", pushError);
    }

    return res.status(200).json({
      ok: true,
      message: "Fan verification rejected",
      docid,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = rejectFan;