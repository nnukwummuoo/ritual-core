const documentdb = require("../../Creators/document");
const { deleteFile } = require("../../utiils/storj");

// DELETE /getdocument/:docid
// Admin-only: permanently delete a creator or fan verification application,
// including its uploaded photos. Does not touch the user's verified/rejected
// status — it only removes the application record itself.
const deleteApplicationDocument = async (req, res) => {
  const { docid } = req.params;

  if (!docid) {
    return res.status(400).json({ ok: false, message: "Document ID is required" });
  }

  try {
    const document = await documentdb.findById(docid).exec();
    if (!document) {
      return res.status(404).json({ ok: false, message: "Application not found" });
    }

    const idPublicId = document.idPhotofile?.idPhotofilepublicid;
    const holdingIdPublicId = document.holdingIdPhotofile?.holdingIdPhotofilepublicid;

    if (idPublicId) await deleteFile(idPublicId, "creator-application").catch(() => false);
    if (holdingIdPublicId) await deleteFile(holdingIdPublicId, "creator-application").catch(() => false);

    await document.deleteOne();

    return res.status(200).json({
      ok: true,
      message: "Application deleted permanently",
      docid,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = deleteApplicationDocument;