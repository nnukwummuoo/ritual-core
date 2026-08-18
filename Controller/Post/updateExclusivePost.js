const exclusivePostdb = require("../../Creators/exclusivePost");
const { uploadSingleFileToCloudinary } = require("../../utiils/storj");

const updateExclusivePost = async (req, res) => {
  try {
    // The frontend sends all fields bundled as a JSON string under "data"
    // (multipart/form-data can't nest objects directly), so it must be
    // parsed first — reading req.body.postid etc. directly is always undefined.
    let data;
    try {
      data = JSON.parse(req.body.data);
    } catch {
      return res.status(400).json({ ok: false, message: "Invalid request data" });
    }

    const postid = data.postid || data._id;
    const userid = data.userid;

    if (!postid) {
      return res.status(400).json({ ok: false, message: "Post ID is required" });
    }

    if (!userid) {
      return res.status(400).json({ ok: false, message: "User ID is required" });
    }

    // Find the post
    const existingPost = await exclusivePostdb.findOne({ _id: postid }).exec();

    if (!existingPost) {
      return res.status(404).json({ ok: false, message: "Post not found" });
    }

    // Verify ownership
    if (String(existingPost.userid) !== String(userid)) {
      return res.status(403).json({ ok: false, message: "You can only edit your own posts" });
    }

    // Prepare update data
    const updateData = {};

    // Update content if provided
    if (data.content !== undefined) {
      updateData.content = data.content;
    }

    // Update price if provided
    if (data.price !== undefined) {
      const price = parseFloat(data.price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ ok: false, message: "Invalid price" });
      }
      updateData.price = price;
    }

    
    // Handle file upload if new file is provided
    if (req.file) {
      const result = await uploadSingleFileToCloudinary(req.file, "post");

      if (!result.file_link || !result.public_id) {
        return res.status(500).json({ ok: false, message: "File upload failed" });
      }

      updateData.postfilelink = result.file_link;
      updateData.postfilepublicid = result.public_id;

      // Update posttype based on new file
      if (req.file.mimetype.startsWith("video/")) {
        updateData.posttype = "video";
      } else if (req.file.mimetype.startsWith("image/")) {
        updateData.posttype = "image";
      }
    }

    // Update the post
    const updatedPost = await exclusivePostdb.findByIdAndUpdate(
      postid,
      updateData,
      { new: true }
    ).exec();

    if (!updatedPost) {
      return res.status(500).json({ ok: false, message: "Failed to update post" });
    }

    return res.status(200).json({
      ok: true,
      message: "Exclusive post updated successfully",
      post: updatedPost,
    });
  } catch (err) {
    console.error("Error updating exclusive post:", err);
    return res.status(500).json({ ok: false, message: err.message || "Internal error" });
  }
};

module.exports = updateExclusivePost;

