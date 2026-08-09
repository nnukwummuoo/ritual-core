const followerdb = require("../../Creators/followers");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");
const postdb = require("../../Creators/post");
const photodb = require("../../Creators/usercomplete");
const GlobalSettings = require("../../Creators/GlobalSettings");

/**
 * @desc Get users with most fans (followers)
 * @route GET /api/discover/top-fans
 */
exports.getUsersWithMostFans = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Aggregate followers to count how many followers each user has
    const followersCount = await followerdb.aggregate([
      {
        $group: {
          _id: "$userid",
          followersCount: { $sum: 1 }
        }
      },
      {
        $sort: { followersCount: -1 }
      },
      {
        $limit: limit
      }
    ]);

    // Get user details for each user with most fans
    const usersWithFans = await Promise.all(
      followersCount.map(async (item) => {
        const user = await userdb.findById(item._id).lean();
        if (!user) return null;

        const photo = await photodb.findOne({ useraccountId: item._id }).lean();
        const creator = await creatordb.findOne({ userid: item._id }).lean();

        return {
          userId: user._id,
          name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username || 'Unknown',
          username: user.username || '',
          photoLink: photo?.photoLink || '',
          followersCount: item.followersCount,
          isCreator: !!creator,
          creatorPortfolioId: creator?._id || null,
          hosttype: creator?.hosttype || null,
          isVip: user.isVip || false,
          vipEndDate: user.vipEndDate || null,
        };
      })
    );

    // Filter out null values
    const filteredUsers = usersWithFans.filter(user => user !== null);

    res.status(200).json({
      ok: true,
      message: "Users with most fans fetched successfully",
      users: filteredUsers
    });
  } catch (error) {
    console.error("Get users with most fans error:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch users with most fans",
      error: error.message
    });
  }
};

/**
 * @desc Get creators with most views
 * @route GET /api/discover/top-views
 */
exports.getCreatorsWithMostViews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Get all creators
    const creators = await creatordb
      .find({})
      .lean();

    // Respect the same admin-controlled sort preference used everywhere else
    let settings = await GlobalSettings.findOne({ key: 'main_config' });
    const isNewestFirst = settings ? settings.isNewestCreatorsFirst : false;

    if (isNewestFirst) {
      // Sort by createdAt descending (Newest first)
      creators.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
    } else {
      // Default: Sort by views array length (most views first)
      creators.sort((a, b) => {
        const aViews = Array.isArray(a.views) ? a.views.length : 0;
        const bViews = Array.isArray(b.views) ? b.views.length : 0;
        return bViews - aViews;
      });
    }

    // Limit after sorting
    const limitedCreators = creators.slice(0, limit);


    // Get user details for each creator
    const creatorsWithViews = await Promise.all(
      limitedCreators.map(async (creator) => {
        const user = await userdb.findById(creator.userid).lean();
        if (!user) return null;

        const photo = await photodb.findOne({ useraccountId: creator.userid }).lean();

        // Get first image from creatorfiles or photolink
        let displayImage = '';
        if (creator.creatorfiles && creator.creatorfiles.length > 0) {
          displayImage = creator.creatorfiles[0]?.creatorfilelink || '';
        } else if (creator.photolink && creator.photolink.length > 0) {
          displayImage = creator.photolink[0] || '';
        } else if (photo?.photoLink) {
          displayImage = photo.photoLink;
        }

        const viewsCount = Array.isArray(creator.views) ? creator.views.length : (creator.views || 0);

       return {
          creatorId: creator._id,
          userId: creator.userid,
          name: creator.name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username || 'Unknown',
          hosttype: creator.hosttype || 'Fan Meet',
          displayImage: displayImage,
          viewsCount: viewsCount,
          price: creator.price || 0,
          location: creator.location || '',
          isVip: user.isVip || false,
          vipEndDate: user.vipEndDate || null,
          createdAt: creator.createdAt || null,
        };
      })
    );

    // Filter out null values
    const filteredCreators = creatorsWithViews.filter(creator => creator !== null);

    res.status(200).json({
      ok: true,
      message: "Creators with most views fetched successfully",
      creators: filteredCreators
    });
  } catch (error) {
    console.error("Get creators with most views error:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch creators with most views",
      error: error.message
    });
  }
};

/**
 * @desc Search users and creators by username, full name, or creator name
 * @route GET /api/discover/search-users
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        ok: false,
        message: "Search query is required"
      });
    }

    const searchQuery = query.trim();

    // Search users by username or full name (case-insensitive)
    const users = await userdb
      .find({
        $or: [
          { username: { $regex: searchQuery, $options: 'i' } },
          { firstname: { $regex: searchQuery, $options: 'i' } },
          { lastname: { $regex: searchQuery, $options: 'i' } }
        ]
      })
      .limit(parseInt(limit))
      .lean();

    // Search creators by creator name (case-insensitive)
    const creators = await creatordb
      .find({
        name: { $regex: searchQuery, $options: 'i' }
      })
      .limit(parseInt(limit))
      .lean();

    // Get user details with photos (always as "user" type, even if they're also creators)
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const photo = await photodb.findOne({ useraccountId: user._id }).lean();

        return {
          userId: user._id,
          name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username || 'Unknown',
          username: user.username || '',
          photoLink: photo?.photoLink || '',
          isCreator: false, // Always false for user entries
          creatorPortfolioId: null,
          hosttype: null,
          resultType: 'user', // Mark as user type
          isVip: user.isVip || false,
          vipEndDate: user.vipEndDate || null,
        };
      })
    );

    // Get creator details (always as "creator" type, even if their user was in user search)
    const creatorsWithDetails = await Promise.all(
      creators.map(async (creator) => {
        const user = await userdb.findById(creator.userid).lean();
        if (!user) return null;

        const photo = await photodb.findOne({ useraccountId: creator.userid }).lean();

        // Get creator display image
        let displayImage = '';
        if (creator.creatorfiles && creator.creatorfiles.length > 0) {
          displayImage = creator.creatorfiles[0]?.creatorfilelink || '';
        } else if (creator.photolink && creator.photolink.length > 0) {
          displayImage = creator.photolink[0] || '';
        } else if (photo?.photoLink) {
          displayImage = photo.photoLink;
        }

        return {
          userId: creator.userid,
          name: creator.name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username || 'Unknown',
          username: user.username || '',
          photoLink: displayImage,
          isCreator: true, // Always true for creator entries
          creatorPortfolioId: creator._id,
          hosttype: creator.hosttype || 'Fan Meet',
          resultType: 'creator', // Mark as creator type
          isVip: user.isVip || false,
          vipEndDate: user.vipEndDate || null,
        };
      })
    );

    // Combine results without deduplication - show both user and creator entries separately
    const allResults = [...usersWithDetails];
    creatorsWithDetails.forEach(creator => {
      if (creator) {
        allResults.push(creator);
      }
    });

    // Limit total results
    const limitedResults = allResults.slice(0, parseInt(limit));

    res.status(200).json({
      ok: true,
      message: "Users and creators found successfully",
      users: limitedResults,
      total: limitedResults.length
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to search users",
      error: error.message
    });
  }
};

/**
 * @desc Search posts by hashtags
 * @route GET /api/discover/search-hashtags
 */
exports.searchPostsByHashtags = async (req, res) => {
  try {
    const { hashtag, limit = 20, page = 1 } = req.query;

    if (!hashtag) {
      return res.status(400).json({
        ok: false,
        message: "Hashtag parameter is required"
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const hashtagLower = hashtag.toLowerCase().replace('#', '');

    // Use aggregation to include likes and comments (similar to Getpost.js)
    const posts = await postdb.aggregate([
      // Match posts with the hashtag
      {
        $match: {
          hashtags: { $in: [hashtagLower] }
        }
      },
      // Sort by creation date
      {
        $sort: { createdAt: -1 }
      },
      // Skip and limit for pagination
      {
        $skip: skip
      },
      {
        $limit: parseInt(limit)
      },
      // Make ObjectId copy of userid for joins
      {
        $addFields: {
          useridObj: { $toObjectId: "$userid" },
        },
      },
      // Join with users
      {
        $lookup: {
          from: "userdbs",
          localField: "useridObj",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      // Join with likes
      {
        $lookup: {
          from: "likes",
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
      // Join with comments
      {
        $lookup: {
          from: "comments",
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
      // Project the fields we need
      {
        $project: {
          postId: { $toString: "$_id" },
          _id: { $toString: "$_id" },
          postid: { $toString: "$_id" },
          id: { $toString: "$_id" },
          userId: "$userid",
          userid: "$userid",
          content: 1,
          postfilelink: 1,
          posttype: 1,
          type: "$posttype",
          hashtags: 1,
          createdAt: 1,
          created_at: "$createdAt",
          likeCount: 1,
          likedBy: 1,
          commentCount: { $size: "$comments" },
          comments: 1,
          thumblink: 1,
          user: {
            name: {
              $concat: [
                { $ifNull: ["$user.firstname", ""] },
                " ",
                { $ifNull: ["$user.lastname", ""] }
              ]
            },
            firstname: "$user.firstname",
            lastname: "$user.lastname",
            username: "$user.username",
            photoLink: "",
            isVip: { $ifNull: ["$user.isVip", false] },
            vipEndDate: "$user.vipEndDate"
          }
        }
      }
    ]);

    // Get photo links for each user and enrich comments with user information
    const postsWithPhotos = await Promise.all(
      posts.map(async (post) => {
        const photo = await photodb.findOne({ useraccountId: post.userid }).lean();

        // Update user photoLink
        if (photo?.photoLink) {
          post.user.photoLink = photo.photoLink;
        }

        // Format user name
        const userName = `${post.user.firstname || ''} ${post.user.lastname || ''}`.trim() || post.user.username || 'Unknown';
        post.user.name = userName;

        // Enrich comments with user information (similar to Getpost.js)
        if (post.comments && post.comments.length > 0) {
          const enrichedComments = await Promise.all(
            post.comments.map(async (comment) => {
              try {
                // Get user information for this comment
                const commentUser = await userdb.findById(comment.userid).lean();
                const commentUserPhoto = await photodb.findOne({ useraccountId: comment.userid }).lean();

                if (commentUser) {
                  return {
                    ...comment,
                    commentuserphoto: commentUserPhoto?.photoLink || commentUser.photolink || "",
                    commentusername: `${commentUser.firstname || ''} ${commentUser.lastname || ''}`.trim() || commentUser.username || "",
                    commentuserid: commentUser._id,
                    isVip: commentUser.isVip || false,
                    vipStartDate: commentUser.vipStartDate,
                    vipEndDate: commentUser.vipEndDate,
                    firstname: commentUser.firstname || "",
                    lastname: commentUser.lastname || "",
                    username: commentUser.username || ""
                  };
                }

                return comment;
              } catch (err) {
                console.error('Error enriching comment:', err);
                return comment;
              }
            })
          );

          post.comments = enrichedComments;
        }

        return post;
      })
    );

    res.status(200).json({
      ok: true,
      message: "Posts found successfully",
      posts: postsWithPhotos,
      total: postsWithPhotos.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error("Search posts by hashtags error:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to search posts by hashtags",
      error: error.message
    });
  }
};

