const creators = require("../../Creators/creators");
const GlobalSettings = require("../../Creators/GlobalSettings");

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