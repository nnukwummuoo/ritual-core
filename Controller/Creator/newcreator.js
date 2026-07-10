const creators = require("../../Creators/creators");
const userdb = require("../../Creators/userdb");
const { uploadManyFilesToCloudinary } = require("../../utiils/storj");

const createCreator = async (req, res) => {
  const data = req.body;

  const userid = data.userid;
  const name = data.name;
  const age = data.age;
  const location = data.location;
  const state = data.state || "";
let tours = [];
try {
  tours = data.tours ? JSON.parse(data.tours) : [];
} catch {
  tours = [];
}
  const price = data.price;
  const duration = data.duration;
  const description = data.description;
  const gender = data.gender;
  const timeava = data.timeava;
  const daysava = data.daysava;
  const hosttype = data.hosttype;
  const photolink = data.photolink || [];

  if (!userid) {
    return res.status(400).json({
      ok: false,
      message: "user Id invalid!!",
    });
  }

  console.log("ontop checking user");

  let currentuser = await userdb.findOne({ _id: userid }).exec();

  if (!currentuser) {
    console.log("User failed ");
    return res.status(409).json({
      ok: false,
      message: `User can not create creator`,
    });
  }

  // Check if user already has a portfolio
  if (currentuser.creator_portfolio === true) {
    return res.status(400).json({
      ok: false,
      message: "Portfolio already exists",
    });
  }

  /**
   * Validate incoming files and upload using in-memory buffers
   * Multer may expose req.files as array (upload.any()) or object (upload.fields())
   */
  const rawFiles = req.files;
  const filesArray = Array.isArray(rawFiles)
    ? rawFiles
    : rawFiles && typeof rawFiles === 'object'
      ? (Array.isArray(rawFiles.creatorfiles) ? rawFiles.creatorfiles : Object.values(rawFiles).flat())
      : [];
  const filesCount = filesArray.length;
  console.log("[createCreator] filesCount:", filesCount, "photolink.length:", Array.isArray(photolink) ? photolink.length : 0);

  // Require files for all users, regardless of creator_verified status
  if (!filesCount && !photolink.length) {
    return res.status(400).json({
      ok: false,
      message: "No files uploaded. Please attach at least one image file.",
    });
  }

  // Upload new files - always upload if files are provided
  const results = (filesArray.length > 0)
    ? (await uploadManyFilesToCloudinary(filesArray, 'creator')) || []
    : [];

  // Merge uploaded files with any photolinks passed from frontend
  const uploadedFiles = results
    .filter((result) => result && result.public_id && result.file_link)
    .map((result) => ({
      creatorfilelink: result.file_link,
      creatorfilepublicid: result.public_id,
    }));

  // Only use photolinks from request if no files were uploaded
  let creatorfiles = uploadedFiles;

  if (uploadedFiles.length === 0 && photolink.length > 0) {
    const photolinksFromReq = photolink.map((link) => ({
      creatorfilelink: link,
      creatorfilepublicid: null,
    }));
    creatorfiles = photolinksFromReq;
  }

  // Require successful file upload for all users
  if (!creatorfiles.length) {
    const hadFiles = filesCount > 0;
    console.error("[createCreator] File upload failed. hadFiles:", hadFiles, "resultsWithLink:", results.filter((r) => r && r.file_link).length);
    return res.status(400).json({
      ok: false,
      message: hadFiles
        ? "File upload failed. Please try again with valid image files. Check server logs for details."
        : "No files uploaded. Please attach at least one image file.",
    });
  }

  try {
    const creator = {
      userid,
      creatorfiles,
      verify: currentuser?.creator_verified ? "live" : "unverified",
      name,
      age,
      location,
      state,
      tours,
      price,
      duration,
      description,
      gender,
      timeava,
      daysava,
      hosttype,
    };

    const newCreator = await creators.create(creator);

    await currentuser
      .updateOne({
        creator_portfolio: true,
        creator_portfolio_id: newCreator._id,
        creator_portfolio_id: newCreator._id,
      })
      .exec();

    await currentuser.save();

    return res.status(200).json({
      ok: true,
      message: `Creator hosted successfully`,
      id: newCreator._id,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`,
    });
  }
};

module.exports = createCreator;