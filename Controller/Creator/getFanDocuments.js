// Controller/Creator/getFanDocuments.js  (fan docs only)
let documentdb = require("../../Creators/document");
let userdb = require("../../Creators/userdb");
const { withStablePhotoLinks } = require("../../utiils/verificationPhotoUrls");

const getFanDocuments = async (req, res) => {
  try {
    // Only fetch fan verification submissions
    const docs = await documentdb.find({ fan_submission: true }).exec();

    if (!docs || docs.length === 0) {
      return res.status(200).json({ ok: true, count: 0, documents: [] });
    }

    const enriched = await Promise.all(
      docs.map(async (doc) => {
        try {
          const user = await userdb.findById(doc.userid).exec();
          return {
               ...withStablePhotoLinks(doc, req),
            firstname: doc.firstname || user?.firstname || "",
            lastname:  doc.lastname  || user?.lastname  || "",
            username:  user?.username || "",
            photolink: user?.photolink || "",
          };
        } catch {
           return withStablePhotoLinks(doc, req);
        }
      })
    );

    return res.status(200).json({ ok: true, count: enriched.length, documents: enriched });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = getFanDocuments;