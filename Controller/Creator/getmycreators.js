const creators = require("../../Creators/creators");

const getMyCreators = async (req, res) => {
  const userid = req.body.userid;

  if (!userid) {
    return res.status(400).json({ ok: false, message: "user Id invalid!!" });
  }

  try {
    const currentuser = await creators.find({ userid }).exec();

    if (!currentuser || currentuser.length === 0) {
      return res
        .status(200)
        .json({ ok: false, message: "user host empty", host: [] });
    }

    const host = currentuser.map((creator) => {
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
        views: creator.views || 0,
        isOnline: creator.isOnline || false,
      };
    });

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
      // Default sorting logic (if any specific to 'my creators' or generic)
      // For consistency, we can apply the same Online > Views if desired, 
      // or just leave it as DB order (which is effectively arbitrary or insertion order).
      // Given the user wants a toggle, we'll apply the default sort here too if they want it "off".

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

    return res.status(200).json({ ok: true, message: "Creators Fetched successfully", host });
  } catch (err) {
    return res.status(500).json({ ok: false, message: `${err.message}!` });
  }
};

module.exports = getMyCreators;
