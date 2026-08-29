let admindb = require("../../Creators/admindb");
const userdb = require("../../Creators/userdb");
let documentdb = require("../../Creators/document");

const rejectdocument = async (req, res) => {
  const userid = req.body.userid;
  const docID = req.body.docid;

  if (!userid || !docID) {
    return res.status(400).json({ ok: false, message: "User ID or Document ID invalid!!" });
  }

  try {
    // 1. Find the document
    const doc = await documentdb.findById(docID).exec();
    if (!doc) {
      return res.status(404).json({ ok: false, message: "Document not found!" });
    }

    // 2. Delete the document (or mark rejected if you want history instead of deletion)
    await doc.deleteOne();

   // 3. Reset user's model info
    const user = await userdb.findById(userid).exec();
    if (user) {
      user.creator_portfolio_id = "";
      user.isCreator = false;
      user.Creator_Application_status = "rejected";
      await user.save();
    }

    // 4. Notify user
    let respond = {
      userid,
      message: "Your creator application has been rejected",
      seen: false,
    };
    await admindb.create(respond);

    // 5. Send response
    return res.status(200).json({
      ok: true,
      message: "Creator application document rejected successfully",
      rejectedDocId: docID,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = rejectdocument;
