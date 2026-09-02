const creators = require("../../Creators/creators");
const userdb = require("../../Creators/userdb");
const admindb = require("../../Creators/admindb");
const { pushmessage } = require("../../utiils/sendPushnot");

const updateView = async (req, res) => {
  const { creator_portfolio_id, userId, username } = req.body;

  try {
    let currentCreator = null;

    // 1. FIND CREATOR BY ID OR USERNAME
    if (creator_portfolio_id) {
      // fetch directly by creator id
      currentCreator = await creators.findById(creator_portfolio_id).exec();
    } 
    else if (username) {
      const cleanUsername = String(username)
        .replace(/^@/, "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const account = await userdb.findOne({
        $or: [
          { username: new RegExp("^@?" + cleanUsername + "$", "i") },
          { nickname: new RegExp("^@?" + cleanUsername + "$", "i") }
        ]
      }).exec();

      if (!account) {
        return res.status(404).json({
          ok: false,
          message: "User not found in userdb"
        });
      }

      // fetch creator using user account id
      currentCreator = await creators.findOne({
        userid: account._id.toString()
      }).exec();
    }

    // 2. CHECK IF CREATOR EXISTS
    if (!currentCreator) {
      return res.status(404).json({
        ok: false,
        message: "Creator not found"
      });
    }

    // 3. GET CURRENT VIEWS
    let currentViews = currentCreator.views || [];

    // 4. ADD VIEW IF NEW USER (this array still drives ranking — unchanged)
    if (userId) {
      if (!currentViews.includes(userId)) {
        currentViews.push(userId);

        await creators.findByIdAndUpdate(currentCreator._id, {
          views: currentViews,
        });
      }
    } else {
      // Anonymous visitor — can't dedupe by identity, so just count the visit.
      // Never affects ranking; only affects the combined total below.
      await creators.findByIdAndUpdate(currentCreator._id, {
        $inc: { nonUserViews: 1 },
      });
    }

    const totalViews = currentViews.length;
    const nonUserViewsCount = userId ? (currentCreator.nonUserViews || 0) : (currentCreator.nonUserViews || 0) + 1;
    // Notifications are about visibility/momentum, so they're based on total
    // traffic (user + non-user) — matches what's actually shown on the
    // profile. Ranking above stays user-only and is untouched by this.
    const combinedTotal = totalViews + nonUserViewsCount;
    const lastNotificationView = currentCreator.lastNotificationView || 0;

    // 5. NOTIFICATION SYSTEM (MILESTONES ONLY)
    // Evaluated on EVERY visit now, not just new-unique-user ones — otherwise
    // a creator whose growth is mostly from shared links would rarely (or
    // never) trigger a check at all.
    if (combinedTotal > 0) {
      let shouldNotify = false;
      let notificationTitle = "";
      let notificationMessage = "";
      let notificationEmoji = "";

      // Determine notification interval based on view count
      // Only send notifications at milestone views (not at 0)
      if (combinedTotal < 100) {
        // Below 100 views: every 10 views (10, 20, 30, 40, 50, 60, 70, 80, 90)
        if (combinedTotal % 10 === 0 && combinedTotal > lastNotificationView) {
          shouldNotify = true;
          notificationTitle = "You're getting noticed!";
          notificationEmoji = "🎉";
          notificationMessage = `Your portfolio just hit ${combinedTotal} views - fans are starting to discover you 👀`;
        }
      } 
      else if (combinedTotal >= 100 && combinedTotal < 1000) {
        // Between 100-999 views: every 20 views (100, 120, 140, 160, 180, 200, ...)
        if (combinedTotal % 20 === 0 && combinedTotal > lastNotificationView) {
          shouldNotify = true;
          notificationTitle = "Still growing!";
          notificationEmoji = "🔥";
          notificationMessage = `You've reached ${combinedTotal} total views - your visibility keeps climbing 🚀`;
        }
      } 
      else if (combinedTotal >= 1000) {
        // 1000+ views: every 100 views (1000, 1100, 1200, 1300, ...)
        if (combinedTotal % 100 === 0 && combinedTotal > lastNotificationView) {
          shouldNotify = true;
          notificationTitle = "Creator on the rise!";
          notificationEmoji = "🌟";
          notificationMessage = `You just crossed ${combinedTotal} views. You're building real momentum - keep it up 💪`;
        }
      }

      // 6. SEND NOTIFICATION
      if (shouldNotify) {
        try {
          await pushmessage(
            currentCreator.userid,
            `${notificationEmoji} ${notificationMessage}`,
            "/icons/m-logo.png",
            {
              title: notificationTitle,
              type: "view_milestone",
              url: `/creators/${currentCreator._id}`
            }
          );

          // save notification in admin db
          await admindb.create({
            userid: currentCreator.userid,
            message: `${notificationEmoji} ${notificationMessage}`,
            title: notificationTitle,
            seen: false
          });

        // update last notification view count (tracked in combined-total terms now)
          await creators.findByIdAndUpdate(currentCreator._id, {
            lastNotificationView: combinedTotal,
          });

        } catch (notifError) {
          console.error("Error sending view notification:", notifError);
        }
      }
    }

   // 7. RESPONSE
    return res.status(200).json({
      ok: true,
      views: totalViews,
      nonUserViews: nonUserViewsCount,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`,
    });
  }
};

module.exports = updateView;