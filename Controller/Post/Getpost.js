// const {connectdatabase} = require('../../config/connectDB');
// const sdk = require("node-appwrite");

const postdbs = require("../../Creators/post");
const userdbs = require("../../Creators/userdb");
const creatorDB = require("../../Creators/creators");
const comdbs = require("../../Creators/usercomplete");
const commentdbs = require("../../Creators/comment");
const likedbs = require("../../Creators/like");
const alldelete = require("../../utiils/Deletes/deleteAcceptsBook");
const { filterBlockedComments } = require("../../utiils/blockFilter");
const { filterBlockedPosts } = require("../../utiils/blockingUtils");

const readPost = async (req, res) => {
  // let data = await connectdatabase()

  const userid = req.body.userid;
  const page = parseInt(req.body.page) || 1;
  const limit = parseInt(req.body.limit) || 20;
  const skip = (page - 1) * limit;


  try {
    //let  postdb = await data.databar.listDocuments(data.dataid,data.postCol)

    //let  userdb = await data.databar.listDocuments(data.dataid,data.colid)

    //let  comdb = await data.databar.listDocuments(data.dataid,data.userincol)

    //let  commentdb = await data.databar.listDocuments(data.dataid,data.commentCol)

    // let  likedb = await data.databar.listDocuments(data.dataid,data.likeCol)

    // Get all posts without pagination
    const posts = await postdbs.aggregate([
      // make ObjectId copy of userid for joins
      {
        $addFields: {
          useridObj: { $toObjectId: "$userid" },
        },
      },

      // join with users
      {
        $lookup: {
          from: "userdbs", // your users collection name
          localField: "useridObj",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // join with likes
      {
        $lookup: {
          from: "likes", // your Like creator collection
          let: { postId: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$postid", "$$postId"] }
              }
            }
          ],
          as: "likes",
        },
      },
      // Add likeCount and likedBy
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          likedBy: {
            $map: {
              input: "$likes",
              as: "like",
              in: "$$like.userid"
            }
          }
        }
      },

      // join with comments
      {
        $lookup: {
          from: "comments", // your Comment creator collection
          let: { postId: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$postid", "$$postId"] }
              }
            }
          ],
          as: "comments",
        },
      },
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
          likeCount: 1,
          likedBy: 1,
          comments: 1,
          isFollowingAuthor: 1,
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
            vipEndDate: 1,
          },
        },
      },
      // Sort by newest first initially
      { $sort: { createdAt: -1 } },
      // Add pagination
      { $skip: skip },
      { $limit: limit }
    ]);
    // Ensure posts are sorted by recency (newest first)
    const sortedPosts = posts.sort((a, b) => {
      const aDate = new Date(a.createdAt || a.posttime || 0);
      const bDate = new Date(b.createdAt || b.posttime || 0);
      return bDate.getTime() - aDate.getTime();
    });

    // let userdb = await userdbs.find().exec();
    // let comdb = await comdbs.find().exec();
    // let commentdb = await commentdbs.find().exec();
    // let likedb = await likedbs.find().exec();

    alldelete();

    // Filter out posts from blocked users
    const filteredPosts = await filterBlockedPosts(sortedPosts, userid);

    // Enrich posts with creator hosttype and filter comments
    const postsWithFilteredComments = await Promise.all(
      filteredPosts.map(async (post) => {
        // Fetch creator hosttype if user has a creator portfolio
        if (post.user?.creator_portfolio && post.user?.creator_portfolio_id) {
          try {
            const creator = await creatorDB.findById(post.user.creator_portfolio_id).exec();
            if (creator) {
              post.user.hosttype = creator.hosttype;
            }
          } catch (err) {
            console.error('Error fetching creator hosttype:', err);
          }
        }

        // Filter and enrich comments
        if (post.comments && post.comments.length > 0) {

          const filteredComments = await filterBlockedComments(post.comments, userid);

          // Enrich comments with user information
          const enrichedComments = await Promise.all(
            filteredComments.map(async (comment) => {
              try {
                // Get user information for this comment
                const user = await userdbs.findById(comment.userid).exec();
                const userComplete = await comdbs.findOne({ useraccountId: comment.userid }).exec();

                if (user) {
                  const enrichedComment = {
                    ...comment,
                    commentuserphoto: userComplete?.photoLink || user.photolink || "",
                    commentusername: `${user.firstname || ''} ${user.lastname || ''}`.trim(),
                    commentusername: user.username || "",
                    commentuserid: user._id,
                    isVip: user.isVip || false,
                    isVerified: user.creator_verified,
                    vipStartDate: user.vipStartDate,
                    vipEndDate: user.vipEndDate,
                    firstname: user.firstname || "",
                    lastname: user.lastname || ""
                  };


                  return enrichedComment;
                }

                return comment;
              } catch (err) {
                console.error('Error enriching comment:', err);
                return comment;
              }
            })
          );


          return { ...post, comments: enrichedComments };
        }
        return post;
      })
    );


    // Get total count for pagination metadata
    const totalPosts = await postdbs.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;



    return res
      .status(200)
      .json({
        ok: true,
        message: `Posts fetched successfully`,
        post: postsWithFilteredComments,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          hasNextPage,
          hasPrevPage,
          limit
        }
      });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = readPost;
