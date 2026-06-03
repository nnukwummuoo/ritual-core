let documentdb = require("../../Creators/document");
let userdb = require("../../Creators/userdb");

const getFanDocumentByUserId = async (req, res) => {
  try {
    const { userid } = req.params;

    const doc = await documentdb.findOne({
      userid: userid,
      fan_submission: true
    }).exec();

    if (!doc) {
      return res.status(404).json({ ok: false, message: "No verification document found" });
    }

    const user = await userdb.findById(doc.userid).exec();
    const enriched = {
      ...doc.toObject(),
      firstname: doc.firstname || user?.firstname || "",
      lastname: doc.lastname || user?.lastname || "",
      username: user?.username || "",
      photolink: user?.photolink || "",
    };

    return res.status(200).json({ ok: true, document: enriched });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = getFanDocumentByUserId;