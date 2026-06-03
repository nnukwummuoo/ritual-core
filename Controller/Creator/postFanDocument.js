const documentdb = require("../../Creators/document");
const admindb = require("../../Creators/admindb");
const userdb = require("../../Creators/userdb");
const { uploadManyFilesToCloudinary } = require("../../utiils/storj");
const { pushAdminNotification } = require("../../utiils/sendPushnot");

const postFanDocument = async (req, res) => {
  try {
    const data = JSON.parse(req.body.data);
    const { userid } = data;

    if (!userid) {
      return res.status(400).json({ ok: false, message: "User ID is required" });
    }

    if (!req.files || req.files.length !== 2) {
      return res.status(400).json({ ok: false, message: "Both ID photo and selfie with ID are required" });
    }

    // Upload both files to Cloudinary
    const results = await uploadManyFilesToCloudinary(req.files, "creator-application");

    if (!results || results.length < 2 || !results[0].file_link || !results[1].file_link) {
      return res.status(400).json({ ok: false, message: "File upload failed. Please try again." });
    }

    // Map files by field name
    let idPhotofile = {};
    let holdingIdPhotofile = {};

    req.files.forEach((file, index) => {
      if (file.fieldname === "idPhotofile") {
        idPhotofile = {
          idPhotofilelink: results[index].file_link,
          idPhotofilepublicid: results[index].public_id,
        };
      } else if (file.fieldname === "holdingIdPhotofile") {
        holdingIdPhotofile = {
          holdingIdPhotofilelink: results[index].file_link,
          holdingIdPhotofilepublicid: results[index].public_id,
        };
      }
    });

    // Fallback to order-based mapping
    if (!idPhotofile.idPhotofilelink || !holdingIdPhotofile.holdingIdPhotofilelink) {
      idPhotofile = { idPhotofilelink: results[0].file_link, idPhotofilepublicid: results[0].public_id };
      holdingIdPhotofile = { holdingIdPhotofilelink: results[1].file_link, holdingIdPhotofilepublicid: results[1].public_id };
    }

    // Save document — only userid + photos, no personal info required
    await documentdb.create({
      userid,
      idPhotofile,
      holdingIdPhotofile,
      fan_submission: true,   // flag to distinguish fan vs creator docs
    });

    // Update user application status to pending
    await userdb.findByIdAndUpdate(userid, {
      fan_application_status: "pending",
    });

    // Notify user
    await admindb.create({
      userid,
      message: "Your fan verification has been submitted and is under review.",
      seen: false,
    });

    // Push notification to user
    try {
      await pushAdminNotification(
        userid,
        "Your fan verification documents have been submitted. We'll review them shortly.",
        "fan_verification_submitted"
      );
    } catch (pushError) {
      console.error("Push notification error:", pushError);
    }

    // Push notification to admins
    try {
      const admins = await userdb.find({ isAdmin: true }).exec();
      for (const admin of admins) {
        await pushAdminNotification(
          admin._id,
          "📋 New fan verification submitted. Please review the documents.",
          "new_fan_application"
        );
      }
    } catch (adminPushError) {
      console.error("Admin push notification error:", adminPushError);
    }

    return res.status(200).json({ ok: true, message: "Fan verification submitted successfully" });

  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

module.exports = postFanDocument;