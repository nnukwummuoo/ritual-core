const userActivity = require("../Creators/userActivity");
const websiteVisitor = require("../Creators/websiteVisitor");
const userdb = require("../Creators/userdb");

/**
 * Track user connection - called when user connects via socket
 */
const trackUserConnection = async (userid, connectionTime = new Date()) => {
  try {
    if (!userid) return;

    // Get start of day for date normalization
    const today = new Date(connectionTime);
    today.setHours(0, 0, 0, 0);

    // Find or create today's activity record
    let activity = await userActivity.findOne({
      userid,
      date: today,
    });

    if (!activity) {
      activity = await userActivity.create({
        userid,
        date: today,
        sessions: [],
      });
    }

    // Add new session
    activity.sessions.push({
      connectedAt: connectionTime,
      disconnectedAt: null,
      duration: 0,
    });

    await activity.save();

    // Update user's lastActive timestamp
    await userdb.findByIdAndUpdate(userid, { lastActive: connectionTime });
  } catch (error) {
    console.error("❌ [Tracking] Error tracking user connection:", error);
  }
};

  const trackPageView = async (visitorId, userid, path) => {
  try {
    if (!visitorId || !path) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effectiveVisitorId = userid || visitorId;

    let visitor = null;
    if (userid) {
      visitor = await websiteVisitor.findOne({ userid, date: today });
    }
    if (!visitor && effectiveVisitorId) {
      visitor = await websiteVisitor.findOne({ visitorId: effectiveVisitorId, date: today });
    }

    if (!visitor) return; // the initial track-visitor call should already have created today's record

    visitor.pageViews += 1;
    visitor.lastVisit = new Date();
    visitor.pagesVisited.push({ path, timestamp: new Date() });

    // Cap stored history per visitor per day so the array doesn't grow unbounded
    if (visitor.pagesVisited.length > 200) {
      visitor.pagesVisited = visitor.pagesVisited.slice(-200);
    }

    await visitor.save();
  } catch (error) {
    console.error("Error tracking page view:", error);
  }
};


/**
 * Track user disconnection - called when user disconnects
 */
const trackUserDisconnection = async (userid, disconnectionTime = new Date()) => {
  try {
    if (!userid) return;

    // Get start of day
    const today = new Date(disconnectionTime);
    today.setHours(0, 0, 0, 0);

    // Find today's activity record
    const activity = await userActivity.findOne({
      userid,
      date: today,
    });

    if (!activity || !activity.sessions || activity.sessions.length === 0) {
      return;
    }

    // Find the most recent open session
    const openSession = activity.sessions
      .filter((s) => !s.disconnectedAt)
      .sort((a, b) => b.connectedAt - a.connectedAt)[0];

    if (openSession) {
      openSession.disconnectedAt = disconnectionTime;
      openSession.duration = disconnectionTime - openSession.connectedAt;

      // Update total time spent
      activity.totalTimeSpent = activity.sessions.reduce(
        (total, session) => total + (session.duration || 0),
        0
      );

      await activity.save();
    }
  } catch (error) {
    console.error("❌ [Tracking] Error tracking user disconnection:", error);
  }
};

/**
 * Track user activity (posts, likes, comments, etc.)
 */
const trackUserAction = async (userid, actionType = "other") => {
  try {
    if (!userid) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create today's activity record
    let activity = await userActivity.findOne({
      userid,
      date: today,
    });

    if (!activity) {
      activity = await userActivity.create({
        userid,
        date: today,
        activityBreakdown: {
          posts: 0,
          likes: 0,
          comments: 0,
          messages: 0,
          profileViews: 0,
          other: 0,
        },
      });
    }

    // Update activity breakdown
    if (!activity.activityBreakdown) {
      activity.activityBreakdown = {
        posts: 0,
        likes: 0,
        comments: 0,
        messages: 0,
        profileViews: 0,
        other: 0,
      };
    }

    // Increment appropriate counter
    switch (actionType.toLowerCase()) {
      case "post":
        activity.activityBreakdown.posts += 1;
        activity.postsCount += 1;
        break;
      case "like":
        activity.activityBreakdown.likes += 1;
        break;
      case "comment":
        activity.activityBreakdown.comments += 1;
        break;
      case "message":
        activity.activityBreakdown.messages += 1;
        break;
      case "profileview":
        activity.activityBreakdown.profileViews += 1;
        break;
      default:
        activity.activityBreakdown.other += 1;
    }

    activity.activitiesCount += 1;
    await activity.save();

    // Update user's lastActive timestamp
    await userdb.findByIdAndUpdate(userid, { lastActive: new Date() });
  } catch (error) {
    console.error("❌ [Tracking] Error tracking user action:", error);
  }
};

/**
 * Track website visitor (for both logged-in and anonymous users)
 */
const trackWebsiteVisitor = async (visitorData) => {
  try {
    const {
      visitorId,
      userid = null,
      sessionId = null,
      device = {},
      visitTime = new Date(),
      ipAddress = null,
      location = null,
        path = null,
    } = visitorData;

    if (!visitorId) return;

    const today = new Date(visitTime);
    today.setHours(0, 0, 0, 0);

    // For logged-in users, use userid as visitorId to ensure one record per user per day
    // For anonymous users, use the visitorId (which is the temporary ID from localStorage)
    const effectiveVisitorId = userid || visitorId || sessionId;

    // Try to find existing visitor record for today
    // Check both by visitorId and userid to ensure one record per user per day
    let visitor = null;
    if (userid) {
      // For logged-in users, check by userid first (more reliable)
      visitor = await websiteVisitor.findOne({
        userid: userid,
        date: today,
      });
    }

    // If not found and we have a visitorId, check by visitorId (for anonymous users with temp_xxx IDs)
    if (!visitor && effectiveVisitorId) {
      visitor = await websiteVisitor.findOne({
        visitorId: effectiveVisitorId,
        date: today,
      });
    }

    // Also check by sessionId as fallback for anonymous users
    if (!visitor && sessionId && !userid) {
      visitor = await websiteVisitor.findOne({
        sessionId: sessionId,
        date: today,
      });
    }

    if (!visitor) {
      // Get user data if logged in
      let userData = {};
      let isAnonymous = true;

      if (userid) {
        try {
          const user = await userdb.findById(userid).exec();
          if (user) {
            userData = {
              gender: user.gender,
              signedUp: true,
              firstname: user.firstname,
              lastname: user.lastname,
              username: user.username,
            };
            isAnonymous = false;
          }
        } catch (err) {
          console.error("Error fetching user data for visitor tracking:", err);
        }
      }

      // Prepare location data
      const locationData = location ? {
        country: location.country || 'Unknown',
        city: location.city || 'Unknown',
        region: location.region || 'Unknown',
        timezone: location.timezone || 'Unknown',
        ipAddress: ipAddress || location.ipAddress || 'Unknown',
      } : {
        country: 'Unknown',
        city: 'Unknown',
        region: 'Unknown',
        timezone: 'Unknown',
        ipAddress: ipAddress || 'Unknown',
      };

      // Create new visitor record - mark as anonymous if no user ID
      visitor = await websiteVisitor.create({
        visitorId: effectiveVisitorId, // Use effective visitor ID
        userid: userid || null,
        sessionId: sessionId || null,
        date: today,
        device,
        location: locationData,
        firstVisit: visitTime,
        lastVisit: visitTime,
        totalTimeSpent: 0, // Initialize to 0, will be updated by time tracking
        pageViews: 1,
        pagesVisited: path ? [{ path, timestamp: visitTime }] : [],
        signedUp: userData.signedUp || false,
        gender: userData.gender || null,
        isAnonymous: isAnonymous && !userid, // Mark as anonymous if no user ID
      });
    } else {
      // Update existing visitor (same user visiting again today - just update page views and last visit)
      visitor.lastVisit = visitTime;
      visitor.pageViews += 1;

      // Update IP and location if provided and not already set
      if (location && (!visitor.location || !visitor.location.ipAddress || visitor.location.ipAddress === 'Unknown')) {
        const updatedLocation = {
          country: location.country || visitor.location?.country || 'Unknown',
          city: location.city || visitor.location?.city || 'Unknown',
          region: location.region || visitor.location?.region || 'Unknown',
          timezone: location.timezone || visitor.location?.timezone || 'Unknown',
          ipAddress: ipAddress || location.ipAddress || visitor.location?.ipAddress || 'Unknown',
        };
        visitor.location = updatedLocation;
      }

      if (userid && !visitor.userid) {
        visitor.userid = userid;
        visitor.isAnonymous = false; // No longer anonymous
        visitor.visitorId = effectiveVisitorId; // Update visitorId to match userid
        // Update signup status if user is logged in
        const user = await userdb.findById(userid).exec();
        if (user) {
          visitor.signedUp = true;
          visitor.gender = user.gender || visitor.gender;
        }
      }
      await visitor.save();
    }

  } catch (error) {
    console.error("❌ [Tracking] Error tracking website visitor:", error);
  }
};

/**
 * Update visitor time spent
 */
const updateVisitorTimeSpent = async (visitorId, timeSpent) => {
  try {
    if (!visitorId || !timeSpent || timeSpent <= 0) {
      console.log(`⚠️ [Tracking] Invalid time update request: visitorId=${visitorId}, timeSpent=${timeSpent}`);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to find visitor by visitorId first
    let visitor = await websiteVisitor.findOne({
      visitorId: visitorId,
      date: today,
    });

    // If not found, try to find by userid (for logged-in users)
    if (!visitor) {
      visitor = await websiteVisitor.findOne({
        userid: visitorId, // visitorId might be userid for logged-in users
        date: today,
      });
    }

    // If still not found, try by sessionId (for anonymous users)
    if (!visitor) {
      visitor = await websiteVisitor.findOne({
        sessionId: visitorId, // visitorId might be sessionId for anonymous users
        date: today,
      });
    }

    if (visitor) {
      const previousTime = visitor.totalTimeSpent || 0;
      visitor.totalTimeSpent = (visitor.totalTimeSpent || 0) + timeSpent;
      visitor.lastVisit = new Date(); // Update last visit time

      await visitor.save();
    }
  } catch (error) {
    console.error("❌ [Tracking] Error updating visitor time spent:", error);
    console.error("   visitorId:", visitorId, "timeSpent:", timeSpent);
  }
};

module.exports = {
  trackUserConnection,
  trackUserDisconnection,
  trackUserAction,
  trackWebsiteVisitor,
  updateVisitorTimeSpent,
  trackPageView,
};

