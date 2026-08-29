const creators = require("../../Creators/creators");
const userdb = require("../../Creators/userdb");

const getMyCreator = async (req, res) => {
  const userid = req.body?.userid;

  if (!userid) {
    return res.status(400).json({ ok: false, message: "user Id invalid!!" });
  }

  try {
    // Get all creators for all users (public directory)
    let currentuser = await creators.find({}).exec();

    if (!currentuser || currentuser.length === 0) {
      return res
        .status(200)
        .json({ ok: false, message: `No creators found`, host: [] });
    }

    const host = await Promise.all(currentuser.map(async (creator) => {

      // Ensure creatorfiles always has the photolink entries
      let creatorfiles = creator.creatorfiles || [];
      if (creator.photolink && creator.photolink.length) {
        const linksNotInCreatorfiles = creator.photolink.filter(
          (link) => !creatorfiles.some((f) => f.creatorfilelink === link)
        );
        const photolinkFiles = linksNotInCreatorfiles.map((link) => ({
          creatorfilelink: link,
          creatorfilepublicid: null,
        }));
        creatorfiles = [...creatorfiles, ...photolinkFiles];
      }

      const photolink = creatorfiles.map((f) => f.creatorfilelink);

      // Get VIP status, online status, and following status from user data
      let vipStatus = { isVip: false, vipEndDate: null };
      let isOnline = false;
      let isFollowing = false;

      // Try different possible userid field names
      const possibleUserIds = [
        creator.userid,
        creator.userId,
        creator.user_id,
        creator.ownerId,
        creator.owner_id,
        creator.hostid,
        creator.host_id
      ].filter(Boolean);

    let firstPortfolioCreatedAt = null;

      for (const userId of possibleUserIds) {
        try {
          const user = await userdb.findOne({ _id: userId }).exec();
          if (user) {
            vipStatus = {
              isVip: user.isVip || false,
              vipEndDate: user.vipEndDate || null
            };
            isOnline = user.active || false;
            firstPortfolioCreatedAt = user.first_portfolio_created_at || null;

            // Check if current user is following this creator
            if (userid && user.followers && user.followers.includes(userid)) {
              isFollowing = true;
            }
            break; // Found user, stop looking
          }
        } catch (error) {
          // Continue to next user ID
        }
      }

      const NEW_BADGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
      const isNew = !!firstPortfolioCreatedAt &&
        (Date.now() - new Date(firstPortfolioCreatedAt).getTime()) <= NEW_BADGE_WINDOW_MS;

      return {
        hostid: creator._id,
        userid: possibleUserIds[0] || creator.userid, // Include userid for frontend
        photolink,
        creatorfiles, // full files info
        verify: creator.verify,
        name: creator.name,
        age: creator.age,
        location: creator.location,
        price: creator.price,
        duration: creator.duration,
        description: creator.description,
        gender: creator.gender,
        timeava: creator.timeava,
        daysava: creator.daysava,
           hosttype: creator.hosttype,
        exclusiveContentEnabled: creator.exclusiveContentEnabled,
        document: creator.document,
        createdAt: creator.createdAt,
        updatedAt: creator.updatedAt,
        // Include VIP status
        isVip: vipStatus.isVip,
        vipEndDate: vipStatus.vipEndDate,
        // Include views count
        views: creator.views ? creator.views.length : 0,
        // Include online status
        isOnline: isOnline,
        // Include following status
        isFollowing: isFollowing,
        // Server-computed, permanent — see getAllCreators.js for the same logic
        isNew,
      };
    }));


    // Check global sorting preference
    const GlobalSettings = require("../../Creators/GlobalSettings");
    let settings = await GlobalSettings.findOne({ key: 'main_config' });
    const isNewestFirst = settings ? settings.isNewestCreatorsFirst : false;

    if (isNewestFirst) {
      //Sort by createdAt descending (Newest first)
      host.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
    } else {
      // Default sorting: Online > Views
      host.sort((a, b) => {
        // Priority 1: Online creators first
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;

        // Priority 2: Most views (highest first)
        const viewsA = a.views || 0;
        const viewsB = b.views || 0;
        return viewsB - viewsA;
      });
    }

    return res
      .status(200)
      .json({ ok: true, message: `Creator fetched successfully`, host });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = getMyCreator;