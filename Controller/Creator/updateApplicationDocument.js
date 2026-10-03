const documentdb = require("../../Creators/document");
const { updateSingleFileToCloudinary } = require("../../utiils/storj");

// PUT /getdocument/:docid
// Admin-only: edit a creator or fan verification application's fields,
// and optionally replace the ID photo and/or the selfie-with-ID photo.
const updateApplicationDocument = async (req, res) => {
  const { docid } = req.params;

  if (!docid) {
    return res.status(400).json({ ok: false, message: "Document ID is required" });
  }

  try {
    const document = await documentdb.findById(docid).exec();
    if (!document) {
      return res.status(404).json({ ok: false, message: "Application not found" });
    }

    // Text fields sent as JSON in the "data" field (same pattern as postdocument)
    let fields = {};
    if (req.body.data) {
      try {
        fields = JSON.parse(req.body.data);
      } catch {
        return res.status(400).json({ ok: false, message: "Invalid fields payload" });
      }
    }

    const editableFields = [
      "firstname", "lastname", "email", "dob",
      "country", "city", "address", "documentType", "idexpire",
    ];
    editableFields.forEach((key) => {
      if (fields[key] !== undefined) document[key] = fields[key];
    });

    // Optional file replacement — same "creator-application" bucket used on submit
    const files = req.files || [];
    const idPhotoFile = files.find((f) => f.fieldname === "idPhotofile");
    const holdingIdPhotoFile = files.find((f) => f.fieldname === "holdingIdPhotofile");

    if (idPhotoFile) {
      const result = await updateSingleFileToCloudinary(
        document.idPhotofile?.idPhotofilepublicid,
        idPhotoFile,
        "creator-application"
      );
      if (result.file_link) {
        document.idPhotofile = {
          idPhotofilelink: result.file_link,
          idPhotofilepublicid: result.public_id,
        };
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

    await document.save();

    return res.status(200).json({
      ok: true,
      message: "Application updated successfully",
      document,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = updateApplicationDocument;