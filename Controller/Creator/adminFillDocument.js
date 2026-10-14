const documentdb = require("../../Creators/document");
const userdb = require("../../Creators/userdb");
const { uploadManyFilesToCloudinary, updateSingleFileToCloudinary } = require("../../utiils/storj");

// PUT /getdocument/admin/:userid
// Admin-only: create or fill in a verification document for a user who was
// manually marked creator_verified / fan_verified without ever submitting an
// application — so the Creator/Fan Verification section in admin/users/view
// has something to show besides empty fields and no photos.
//
// This intentionally bypasses everything postdocument.js / postFanDocument.js
// enforce (the "already verified" locks, application-status flips, and the
// "your application is under review" notifications) — those locks exist to
// stop a *user* from re-submitting, not to stop an *admin* from backfilling
// a record for someone already verified.
const adminFillDocument = async (req, res) => {
  const { userid } = req.params;

  if (!userid) {
    return res.status(400).json({ ok: false, message: "User ID is required" });
  }

  try {
    const user = await userdb.findById(userid).exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    let fields = {};
    if (req.body.data) {
      try {
        fields = JSON.parse(req.body.data);
      } catch {
        return res.status(400).json({ ok: false, message: "Invalid fields payload" });
      }
    }

    const isFan = !!fields.fan_submission;

    let document = await documentdb.findOne({ userid, fan_submission: isFan }).exec();

    const files = req.files || [];
    const idPhotoFile = files.find((f) => f.fieldname === "idPhotofile");
    const holdingIdPhotoFile = files.find((f) => f.fieldname === "holdingIdPhotofile");

    if (!document) {
      // Creating a record from scratch — both photos are required the first time
      if (!idPhotoFile || !holdingIdPhotoFile) {
        return res.status(400).json({
          ok: false,
          message: "Both the ID photo and the selfie-with-ID photo are required to create a new record.",
        });
      }

      const results = await uploadManyFilesToCloudinary([idPhotoFile, holdingIdPhotoFile], "creator-application");
      if (!results || results.length < 2 || !results[0].file_link || !results[1].file_link) {
        return res.status(400).json({ ok: false, message: "File upload failed. Please try again." });
      }

      document = new documentdb({
        userid,
        fan_submission: isFan,
        verify: true, // the user is already verified — this just backfills the record
        idPhotofile: { idPhotofilelink: results[0].file_link, idPhotofilepublicid: results[0].public_id },
        holdingIdPhotofile: {
          holdingIdPhotofilelink: results[1].file_link,
          holdingIdPhotofilepublicid: results[1].public_id,
        },
      });
    } else {
      // Updating an existing (but perhaps incomplete) record
      document.verify = true;

      if (idPhotoFile) {
        const result = await updateSingleFileToCloudinary(
          document.idPhotofile?.idPhotofilepublicid,
          idPhotoFile,
          "creator-application"
        );
        if (result.file_link) {
          document.idPhotofile = { idPhotofilelink: result.file_link, idPhotofilepublicid: result.public_id };
        }
      }

      if (holdingIdPhotoFile) {
        const result = await updateSingleFileToCloudinary(
          document.holdingIdPhotofile?.holdingIdPhotofilepublicid,
          holdingIdPhotoFile,
          "creator-application"
        );
        if (result.file_link) {
          document.holdingIdPhotofile = {
            holdingIdPhotofilelink: result.file_link,
            holdingIdPhotofilepublicid: result.public_id,
          };
        }
      }
    }

    // Fan documents carry no personal fields — only creator docs do
    if (!isFan) {
      const editableFields = [
        "firstname", "lastname", "email", "dob",
        "country", "city", "address", "documentType", "idexpire",
      ];
      editableFields.forEach((key) => {
        if (fields[key] !== undefined) document[key] = fields[key];
      });
    }

    await document.save();

return res.status(200).json({ ok: true, message: "Verification record saved", document });
  } catch (err) {
    console.error("[adminFillDocument] failed:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message ? `${err.message}` : "Something went wrong while saving. Check server logs for '[adminFillDocument] failed'.",
    });
  }
};

module.exports = adminFillDocument;