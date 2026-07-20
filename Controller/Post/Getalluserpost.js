// const {connectdatabase} = require('../../config/connectDB');
// const sdk = require("node-appwrite");

const postdb = require("../../Creators/post");
const userdb = require("../../Creators/userdb");

const readPost = async (req, res) => {
  const userid = req.body.userid;

  if (!userid) {
    return res
      .status(400)
      .json({ ok: false, message: "Missing required parameter: userid" });
  }

  try {
    // Determine sort order
    const sort = req.body.sort || 'newest';
    const sortStage = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    // Use aggregation to join posts with user information
    const posts = await postdb.aggregate([
      { $match: { userid: userid } },
      { $sort: sortStage },
      {
        $lookup: {
          from: "userdbs",
          localField: "userid",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userid: 1,
          postfilelink: 1,
          postfilepublicid: 1,
          posttime: 1,
          content: 1,
          posttype: 1,
          mediaItems: 1,
          createdAt: 1,
          updatedAt: 1,
          thumblink: 1,
          user: {
            _id: 1,
            firstname: 1,
            lastname: 1,
            username: 1,
            gender: 1,
            country: 1,
            age: 1,
            followers: 1,
            following: 1,
            creator_portfolio: 1,
            creator_portfolio_id: 1,
            creator_verified: 1,
            photolink: 1,
            photoID: 1,
            isVip: 1,
            vipStartDate: 1,
            vipEndDate: 1
          },
        },
      },
    ]);

    // If posts is null or undefined, return an empty array instead of error
    if (!posts) {
      posts = [];
    }

    return res.status(200).json({
      ok: true,
      message: `Posts for user ${userid}`,
      post: posts
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = readPost;
