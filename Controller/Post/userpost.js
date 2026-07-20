// // const {connectdatabase} = require('../../config/connectDB');
// // const sdk = require("node-appwrite");
// const postdata = require("../../Creators/post");
// const commentdata = require("../../Creators/comment");
// const likedata = require("../../Creators/like");
// const userdata = require("../../Creators/userdb");
// const comdata = require("../../Creators/usercomplete");
// const {
//   saveFile,
//   uploadSingleFileToCloudinary,
// } = require("../../utiils/appwrite");

// // configuring fluent-ffmpeg

// const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
// const ffmpeg = require("fluent-ffmpeg");
// ffmpeg.setFfmpegPath(ffmpegPath);

// const fs = require("fs");
// const path = require("path");
// const os = require("os");
// const mime = require("mime-types");

// const createPost = async (req, res) => {
//   console.log("req.body.data", req.body.data);
//   const data = JSON.parse(req.body.data);
//   console.log("data", data);

//   const userid = data.userid;
//   let content = data.content;
//   let posttype = data.posttype;

//   let postfilelink = "";
//   let postfilepublicid = "";

//   if (req.file) {
//     const result = await uploadSingleFileToCloudinary(req.file, `post`);

//     if (!result.file_link && !result.public_id) {
//       console.log("Problem here");
//       return res.status(500).json({
//         ok: false,
//         message: "Something went wrong",
//       });
//     }
//     postfilelink = result.file_link;
//     postfilepublicid = result.public_id;
//   }

//   if (!userid) {
//     console.log("No user id");
//     return res.status(400).json({ ok: false, message: "user Id invalid!!" });
//   }

//   console.log("posting image", postfilelink, postfilepublicid);

//   // let data = await connectdatabase()

//   try {
//     // if(!postfilelink){
//     //     console.log("no photolink")
//     //     postfilelink = ""
//     // }

//     if (!content) {
//       content = "";
//     }

//     let posts = {
//       userid,
//       postfilelink,
//       postfilepublicid,
//       posttime: `${Date.now()}`,
//       content,
//       posttype,
//     };

//     // let currentpostid = await data.databar.createDocument(data.dataid,data.postCol,sdk.ID.unique(),posts)
//     await postdata.create(posts);

//     let currentpostid = await postdata.findOne({ posttime: posts.posttime });
//     let postdb = await postdata.find().exec();
//     let userdb = await userdata.find().exec();
//     let comdb = await comdata.find().exec();

//     let likedb = await likedata.find().exec();
//     let commentdb = await commentdata.find().exec();

//     let post = {};
//     console.log("current posts id " + currentpostid._id);

//     for (let j = 0; j < userdb.length; j++) {
//       for (let k = 0; k < comdb.length; k++) {
//         if (
//           String(currentpostid.userid) === String(userdb[j]._id) &&
//           String(comdb[k].useraccountId) === String(userdb[j]._id)
//         ) {
//           console.log("found post");
//           post = {
//             username: `${userdb[j].firstname} ${userdb[j].lastname}`,
//             username: `${userdb[j].username}`,
//             userphoto: `${comdb[k].photoLink}`,
//             content: `${currentpostid.content}`,
//             postphoto: `${currentpostid.postlink}`,
//             posttime: `${currentpostid.posttime}`,
//             posttype: `${currentpostid.posttype}`,
//             postid: `${currentpostid._id}`,
//             like: [],
//             comment: [],
//             userid: userdb[j]._id,
//           };

//           console.log("post time why " + currentpostid.posttime);
//           console.log("post id why " + currentpostid._id);
//           console.log("post type why " + currentpostid.posttype);
//         }
//       }
//     }

//     for (let j = 0; j < commentdb.length; j++) {
//       if (currentpostid._id === commentdb[j].postid) {
//         post.comment.push(commentdb[j]);
//       }
//     }

//     for (let j = 0; j < likedb.length; j++) {
//       if (currentpostid._id === likedb[j].postid) {
//         post.like.push(likedb[j]);
//       }
//     }
//     console.log("posts " + post.posttime);

//     return res
//       .status(200)
//       .json({ ok: true, message: `Posted successfully`, post: post });
//   } catch (err) {
//     console.log(err);
//     return res.status(500).json({ ok: false, message: `${err.message}!` });
//   }
// };

// const stream = require("stream");

// module.exports = createPost;


const { connectdatabase } = require('../../config/connectDB');
const sdk = require("node-appwrite");
const postdata = require("../../Creators/post");
const commentdata = require("../../Creators/comment");
const likedata = require("../../Creators/like");
const userdata = require("../../Creators/userdb");
const comdata = require("../../Creators/usercomplete");
const {
  uploadSingleFileToCloudinary,
} = require("../../utiils/storj");

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

const fs = require("fs");
const path = require("path");
const os = require("os");
const mime = require("mime-types");

const createPost = async (req, res) => {
  // Support both: JSON string in req.body.data OR plain fields in req.body
  let data;
  if (req.body && typeof req.body.data === "string") {
    try {
      data = JSON.parse(req.body.data);
    } catch (e) {
      return res.status(400).json({ ok: false, message: "Invalid JSON in 'data' field" });
    }
  } else {
    data = {
      userid: req.body?.userid,
      content: req.body?.content,
      posttype: req.body?.posttype,
    };
  }

  const userid = data.userid;
  let content = data.content || "";
  const posttype = data.posttype;

  // Extract hashtags from content (words starting with #)
  const extractHashtags = (text) => {
    if (!text) return [];
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    if (!matches) return [];
    // Remove # and return unique hashtags (lowercase)
    return [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
  };

  const hashtags = extractHashtags(content);

  let mediaItems = [];
if (Array.isArray(req.body?.mediaItems) && req.body.mediaItems.length > 0) {
  mediaItems = req.body.mediaItems
    .filter((m) => m && m.url && m.publicId && (m.type === "image" || m.type === "video"))
    .slice(0, 10);
}

// ------------------------------
// ✅ DAILY UPLOAD LIMIT CHECK
// ------------------------------
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);

const endOfDay = new Date();
endOfDay.setHours(23, 59, 59, 999);

const todaysPosts = await postdata.find({
  userid,
  posttime: { $gte: startOfDay.getTime().toString(), $lte: endOfDay.getTime().toString() },
}).lean();

const countFilesOfType = (t) =>
  todaysPosts.reduce((sum, p) => {
    if (Array.isArray(p.mediaItems) && p.mediaItems.length > 0) {
      return sum + p.mediaItems.filter((m) => m.type === t).length;
    }
    if (p.posttype === t && p.postfilelink) return sum + 1;
    return sum;
  }, 0);

const incomingImageCount = mediaItems.length > 0 ? mediaItems.filter((m) => m.type === "image").length : (posttype === "image" ? 1 : 0);
const incomingVideoCount = mediaItems.length > 0 ? mediaItems.filter((m) => m.type === "video").length : (posttype === "video" ? 1 : 0);

if (countFilesOfType("image") + incomingImageCount > 50) {
  return res.status(400).json({ ok: false, message: "You can only upload 50 images per day." });
}
if (countFilesOfType("video") + incomingVideoCount > 10) {
  return res.status(400).json({ ok: false, message: "You can only upload 10 videos per day." });
}

let postfilelink = req.body?.file_link || "";
let postfilepublicid = req.body?.public_id || "";

if (mediaItems.length > 0) {
  // Keep legacy single-file fields in sync with the first item for backward compatibility
  postfilelink = mediaItems[0].url;
  postfilepublicid = mediaItems[0].publicId;
}

  try {
    // --- Video Upload & Trimming ---
    if (req.file && posttype === "video") {
      if (!req.file.mimetype.startsWith("video/")) {
        return res.status(400).json({ ok: false, message: "Invalid video file" });
      }

      // const tempDir = os.tmpdir();
      // const originalExt = mime.extension(req.file.mimetype);
      // const inputPath = path.join(tempDir, `input-${Date.now()}.${originalExt}`);
      // const outputPath = path.join(tempDir, `trimmed-${Date.now()}.mp4`);

      // Write uploaded buffer to disk
      // fs.writeFileSync(inputPath, req.file.buffer);

      // Trim video to 3 minutes
      // await new Promise((resolve, reject) => {
      //   ffmpeg(inputPath)
      //     .setStartTime("00:00:00")
      //     .setDuration(180)
      //     .videoCodec("libx264")
      //     .audioCodec("aac")
      //     .format("mp4")
      //     .outputOptions([
      //       "-preset veryfast",
      //       "-movflags +faststart"
      //     ])
      //     .output(outputPath)
      //     .on("end", resolve)
      //     .on("error", (err) => {
      //       console.error("FFmpeg error:", err.message);
      //       reject(err);
      //     })
      //     .run();
      // });

      // Read trimmed video into buffer
      // const trimmedBuffer = fs.readFileSync(outputPath);
      // const trimmedFile = {
      //   originalname: req.file.originalname.replace(/\.\w+$/, ".mp4"),
      //   mimetype: "video/mp4",
      //   buffer: trimmedBuffer,
      // };

      // Upload to Cloudinary
      // const result = await uploadSingleFileToCloudinary(trimmedFile, `post`);
      const result = { ...(req.body || {}) };

      // Clean up
      // fs.unlinkSync(inputPath);
      // fs.unlinkSync(outputPath);

      if (!result.file_link || !result.public_id) {
        return res.status(500).json({ ok: false, message: "Upload failed" });
      }

      postfilelink = result.file_link;
      postfilepublicid = result.public_id;
    }

    // --- Image Upload ---
    if (req.file && posttype === "image") {
      // if (!req.file.mimetype.startsWith("image/")) {
      //   return res.status(400).json({ ok: false, message: "Invalid image file" });
      // }

      const result = { ...(req.body || {}) };;

      if (!result.file_link || !result.public_id) {
        return res.status(500).json({ ok: false, message: "Image upload failed" });
      }

      postfilelink = result.file_link;
      postfilepublicid = result.public_id;
    }


    if (!userid) {
      return res.status(400).json({ ok: false, message: "User ID is missing" });
    }

    // --- Save post to DB ---
   const newPost = {
  userid,
  postfilelink,
  postfilepublicid,
  posttime: `${Date.now()}`,
  content,
  posttype: mediaItems.length > 1 ? "mixed" : posttype,
  hashtags,
  mediaItems,
};

    await postdata.create(newPost);

    // Track user activity (post creation)
    const { trackUserAction } = require("../../utiils/trackUserActivity");
    trackUserAction(userid, "post");

    const currentPost = await postdata.findOne({ posttime: newPost.posttime });
    const [userdb, comdb, likedb, commentdb] = await Promise.all([
      userdata.find().exec(),
      comdata.find().exec(),
      likedata.find().exec(),
      commentdata.find().exec(),
    ]);

    let post = {};

    for (let j = 0; j < userdb.length; j++) {
      for (let k = 0; k < comdb.length; k++) {
        if (
          String(currentPost.userid) === String(userdb[j]._id) &&
          String(comdb[k].useraccountId) === String(userdb[j]._id)
        ) {
          post = {
            username: `${userdb[j].firstname} ${userdb[j].lastname}`,
            username: `${userdb[j].username}`,
            userphoto: `${comdb[k].photoLink}`,
            content: currentPost.content,
            postphoto: currentPost.postfilelink,
            posttime: currentPost.posttime,
            posttype: currentPost.posttype,
            postid: currentPost._id,
            mediaItems: currentPost.mediaItems || [],
            like: [],
            comment: [],
            userid: userdb[j]._id,
          };
        }
      }
    }

    for (let j = 0; j < commentdb.length; j++) {
      if (String(currentPost._id) === String(commentdb[j].postid)) {
        post.comment.push(commentdb[j]);
      }
    }

    for (let j = 0; j < likedb.length; j++) {
      if (String(currentPost._id) === String(likedb[j].postid)) {
        post.like.push(likedb[j]);
      }
    }

    return res.status(200).json({ ok: true, message: "Posted successfully", post });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ ok: false, message: err.message || "Internal error" });
  }
};

module.exports = createPost;
