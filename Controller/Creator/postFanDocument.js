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

    // ✅ Lock: verified creators and users with a pending creator application
    // can never successfully submit a fan verification, enforced server-side.
    const existingUser = await userdb.findById(userid).exec();
    if (existingUser && existingUser.creator_verified) {
      return res.status(409).json({
        ok: false,
        message: "Creators cannot submit a fan verification application.",
      });
    }

 const pendingCreatorDoc = await documentdb.findOne({ userid, fan_submission: { $ne: true } }).exec();
    if (pendingCreatorDoc) {
      return res.status(409).json({
        ok: false,
        message: pendingCreatorDoc.verify === true
          ? "Creators cannot submit a fan verification application."
          : "You have a creator application pending review and cannot submit a fan verification application.",
      });
    }

    // ✅ Lock: already-verified fans and users with a pending fan application
    // can never successfully resubmit, enforced server-side.
    if (existingUser && existingUser.fan_verified) {
      return res.status(409).json({
        ok: false,
        message: "You are already a verified fan.",
      });
    }
    if (existingUser && existingUser.fan_application_status === "pending") {
      return res.status(409).json({
        ok: false,
        message: "You already have a fan verification pending review.",
      });
    }
    // Backstop in case the status field and the document record ever drift —
    // mirrors the same existence-based check used for creator applications.
    const pendingFanDoc = await documentdb.findOne({ userid, fan_submission: true }).exec();
    if (pendingFanDoc) {
      return res.status(409).json({
        ok: false,
        message: pendingFanDoc.verify === true
          ? "You are already a verified fan."
          : "You already have a fan verification pending review.",
      });
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
      message: "Fan verification submitted — currently under review.",
      seen: false,
    });

    // Push notification to user
    try {
      await pushAdminNotification(
        userid,
        "✅ Fan verification submitted — currently under review.",
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