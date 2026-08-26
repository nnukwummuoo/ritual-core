const documentdb = require("../../Creators/document");
const userdb = require("../../Creators/userdb");

const checkDocumentStatus = async (req, res) => {
  const userid = req.params.userid;
  const type = req.query.type; // "fan" or "creator"

  if (!userid) {
    return res.status(400).json({ ok: false, message: "User ID is required" });
  }

  try {
    if (type === "fan") {
      // Check fan_application_status on the user record
      const user = await userdb.findById(userid).exec();
      if (!user) return res.status(200).json({ status: "none" });

      const fanStatus = user.fan_application_status || "none";
      const statusMap = {
        none:     "none",
        pending:  "pending",
        accepted: "approved",
        approved: "approved",
        rejected: "rejected",
        declined: "rejected",
      };
      return res.status(200).json({ status: statusMap[fanStatus] || "none" });

  } else {
      // Creator: check only docs where fan_submission is NOT true
      const doc = await documentdb.findOne({ userid, fan_submission: { $ne: true } })
        .sort({ createdAt: -1 })
        .exec();

      if (doc) {
        // The document itself carries the real verdict — approval marks
        // verify=true without deleting the record, so its presence alone
        // can't tell us "pending" vs "approved".
        if (doc.verify === true) {
          return res.status(200).json({ status: "approved" });
        }
        return res.status(200).json({ status: "pending" });
      }

      const user = await userdb.findById(userid).exec();
      if (user && user.Creator_Application_status) {
        const statusMap = {
          none:     "none",
          pending:  "pending",
          accepted: "approved",
          rejected: "rejected",
        };
        return res.status(200).json({ status: statusMap[user.Creator_Application_status] || "none" });
      }

      return res.status(200).json({ status: "none" });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = checkDocumentStatus;