const creators = require("../../Creators/creators");
const GlobalSettings = require("../../Creators/GlobalSettings");

const userdb = require("../../Creators/userdb");

const NEW_BADGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const isWithinNewBadgeWindow = (firstPortfolioCreatedAt) =>
  !!firstPortfolioCreatedAt &&
  (Date.now() - new Date(firstPortfolioCreatedAt).getTime()) <= NEW_BADGE_WINDOW_MS;

const getAllCreators = async (req, res) => {
  try {
    // Get all creators (no sorting at database level for flexibility)
    const allCreators = await creators
      .find({})
      .exec();

    if (!allCreators || allCreators.length === 0) {
      return res
        .status(200)
        .json({ ok: false, message: "No creators found", host: [] });
    }

    // Batch-fetch first_portfolio_created_at for every creator's owning user
    // in one query, so the "New" badge stays a single flat DB lookup even
    // on this public endpoint.
    const userIds = [...new Set(allCreators.map((c) => c.userid).filter(Boolean))];
    const owners = await userdb.find({ _id: { $in: userIds } }, "first_portfolio_created_at").exec();
    const firstPortfolioMap = new Map(owners.map((u) => [String(u._id), u.first_portfolio_created_at]));

    const host = allCreators.map((creator) => {
      const photolink = creator.creatorfiles.map((creatorfile) => creatorfile.creatorfilelink);

      return {
        hostid: creator._id,
        photolink,
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
        userid: creator.userid,
        isVip: creator.isVip || false,
        vipEndDate: creator.vipEndDate || null,
        isOnline: creator.isOnline || false,
        views: creator.views || 0,
        isFollowing: false,
        // Server-computed, permanent — tied to the account's very first ever
        // portfolio, never resets on delete/recreate, ignores client storage.
        isNew: isWithinNewBadgeWindow(firstPortfolioMap.get(String(creator.userid))),
      };
    });

    // Check global sorting preference
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

    return res.status(200).json({
      ok: true,
      message: "All creators fetched successfully",
      host
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = getAllCreators;