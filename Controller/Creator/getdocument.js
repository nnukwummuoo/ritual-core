let documentdb = require("../../Creators/document");
let userdb = require("../../Creators/userdb");

const getdocument = async (req, res) => {
  try {
    const docs = await documentdb.find({}).exec();

    if (!docs || docs.length === 0) {
      return res.status(404).json({ ok: false, message: "No documents found" });
    }

    // Fetch every referenced user in one query instead of one query per
    // document (was an N+1 — slow and the main thing that could make this
    // endpoint feel like it hangs as the documents collection grows).
    const userIds = [...new Set(docs.map((d) => d.userid).filter(Boolean))];
    const users = userIds.length > 0
      ? await userdb.find({ _id: { $in: userIds } })
          .select("firstname lastname username photolink")
          .exec()
      : [];
    const usersById = new Map(users.map((u) => [u._id.toString(), u]));

    const enriched = docs.map((doc) => {
      const user = usersById.get(doc.userid?.toString());
      return {
        ...doc.toObject(),
        firstname: doc.firstname || user?.firstname || "",
        lastname:  doc.lastname  || user?.lastname  || "",
        username:  user?.username  || "",
        photolink: user?.photolink || "",
      };
    });

    return res.status(200).json({
      ok: true,
      count: enriched.length,
      documents: enriched,
    });

  } catch (err) {
    console.error("[getdocument] failed:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Could not load documents" });
  }
};

module.exports = getdocument;