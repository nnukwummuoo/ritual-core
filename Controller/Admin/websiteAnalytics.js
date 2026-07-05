const userdb = require("../../Creators/userdb");
const userActivity = require("../../Creators/userActivity");
const websiteVisitor = require("../../Creators/websiteVisitor");
const postdata = require("../../Creators/post");
const completedb = require("../../Creators/usercomplete");

const getWebsiteAnalytics = async (req, res) => {
  try {
    const { period = '7days' } = req.query; // Default to last 7 days
    
    // Determine date range based on period
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate.setHours(23, 59, 59, 999);
        break;
      case '7days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'all':
        startDate = new Date(0); // Start from epoch
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    // Pagination parameters
    const userRankingPage = parseInt(req.query.userRankingPage) || 1;
    const visitorsPage = parseInt(req.query.visitorsPage) || 1;
    const itemsPerPage = 10;

    // Get all visitors in the period (every user that visits website)
    // Each user is saved once per day, so we get unique visitors per day
    const allVisitors = await websiteVisitor.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: -1 }).exec();

    // Calculate total visitors - count unique visitors across the period
    // Since we save one record per user per day, we can count unique userids + anonymous visitorIds
    const uniqueVisitorSet = new Set(
      allVisitors.map(v => {
        // For logged-in users, use userid
        // For anonymous, use visitorId
        return v.userid ? v.userid.toString() : v.visitorId.toString();
      })
    );
    const totalVisitors = uniqueVisitorSet.size; // Total unique visitors in the period

    // Get daily data for chart
    const dailyData = [];
    const currentDate = new Date(startDate);
    
    // Limit the number of days to prevent performance issues (max 365 days)
    const maxDays = 365;
    let dayCount = 0;
    
    while (currentDate <= endDate && dayCount < maxDays) {
      dayCount++;
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayKey = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;
      const dayName = dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Count visitors for this day
      const dayVisitors = allVisitors.filter(v => {
        const visitDate = new Date(v.date);
        return visitDate >= dayStart && visitDate <= dayEnd;
      });

      // Count unique visitors (by userid for logged-in, or visitorId for anonymous)
      // Since we save one record per user per day, each record in dayVisitors is a unique visitor
      const uniqueVisitorIds = new Set(
        dayVisitors.map(v => {
          // For logged-in users, use userid to ensure uniqueness per day
          // For anonymous, use visitorId
          return v.userid ? v.userid.toString() : v.visitorId.toString();
        })
      );
      const uniqueVisitors = uniqueVisitorIds.size;
      
      // Total visitors for the day (each visitor is saved once per day, so this is the count)
      const totalDayVisitors = dayVisitors.length;

      // Count sign-ups for this day
      const signUps = await userdb.find({
        createdAt: {
          $gte: dayStart,
          $lte: dayEnd,
        },
      }).exec();

      // Count sign-ups by gender
      const maleSignUps = signUps.filter(u => u.gender === "male" || u.gender === "Male").length;
      const femaleSignUps = signUps.filter(u => u.gender === "female" || u.gender === "Female").length;
      const otherSignUps = signUps.length - maleSignUps - femaleSignUps;

      // Calculate average time spent
      const totalTimeSpent = dayVisitors.reduce((sum, v) => sum + (v.totalTimeSpent || 0), 0);
      const avgTimeSpent = uniqueVisitors > 0 ? totalTimeSpent / uniqueVisitors : 0;
      const avgTimeSpentHours = avgTimeSpent / (1000 * 60 * 60);

      // Get user activity for this day
      const activities = await userActivity.find({
        date: {
          $gte: dayStart,
          $lte: dayEnd,
        },
      }).exec();

      // Calculate total time spent by users
      const totalUserTimeSpent = activities.reduce((sum, a) => sum + (a.totalTimeSpent || 0), 0);
      const activeUsers = activities.length;
      const avgUserTimeSpent = activeUsers > 0 ? totalUserTimeSpent / activeUsers : 0;
      const avgUserTimeSpentHours = avgUserTimeSpent / (1000 * 60 * 60);

      // Count posts created this day
      const posts = await postdata.find({
        $or: [
          {
            createdAt: {
              $gte: dayStart,
              $lte: dayEnd,
            },
          },
          {
            posttime: {
              $gte: dayStart.getTime().toString(),
              $lte: dayEnd.getTime().toString(),
            },
          },
        ],
      }).exec();
      const postsCount = posts.length;

      dailyData.push({
        day: dayName,
        dayKey,
        date: dayStart,
        dayNumber: dayStart.getDate(),
        visitors: {
          total: totalDayVisitors,
          unique: uniqueVisitors,
        },
        signUps: {
          total: signUps.length,
          male: maleSignUps,
          female: femaleSignUps,
          other: otherSignUps,
        },
        timeSpent: {
          avgHours: parseFloat(avgTimeSpentHours.toFixed(2)),
          totalHours: parseFloat((totalTimeSpent / (1000 * 60 * 60)).toFixed(2)),
        },
        userActivity: {
          activeUsers: activeUsers,
          avgHoursPerUser: parseFloat(avgUserTimeSpentHours.toFixed(2)),
          totalHours: parseFloat((totalUserTimeSpent / (1000 * 60 * 60)).toFixed(2)),
          postsCount: postsCount,
        },
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get user ranking - aggregate all activities in the period
    const allActivitiesInPeriod = await userActivity.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).exec();

    // Aggregate user activities
    const userActivityMap = new Map();
    allActivitiesInPeriod.forEach(activity => {
      const userId = activity.userid.toString();
      if (!userActivityMap.has(userId)) {
        userActivityMap.set(userId, {
          userid: userId,
          totalTimeSpent: 0,
          totalPosts: 0,
          totalActivities: 0,
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
      const userData = userActivityMap.get(userId);
      userData.totalTimeSpent += activity.totalTimeSpent || 0;
      userData.totalPosts += activity.postsCount || 0;
      userData.totalActivities += activity.activitiesCount || 0;
      
      if (activity.activityBreakdown) {
        userData.activityBreakdown.posts += activity.activityBreakdown.posts || 0;
        userData.activityBreakdown.likes += activity.activityBreakdown.likes || 0;
        userData.activityBreakdown.comments += activity.activityBreakdown.comments || 0;
        userData.activityBreakdown.messages += activity.activityBreakdown.messages || 0;
        userData.activityBreakdown.profileViews += activity.activityBreakdown.profileViews || 0;
        userData.activityBreakdown.other += activity.activityBreakdown.other || 0;
      }
    });

    // Get user details and create ranking
    const userRanking = [];
    for (const [userId, activityData] of userActivityMap.entries()) {
      try {
        const user = await userdb.findById(userId).exec();
        const userComplete = await completedb.findOne({ useraccountId: userId }).exec();
        
        // Get latest visitor record for this user to get IP and location
        const latestVisitor = await websiteVisitor.findOne({
          userid: userId,
          date: { $gte: startDate, $lte: endDate },
        }).sort({ date: -1 }).exec();
        
        const userLocation = latestVisitor?.location ? {
          ipAddress: latestVisitor.location.ipAddress || "Unknown",
          country: latestVisitor.location.country || "Unknown",
          city: latestVisitor.location.city || "Unknown",
          region: latestVisitor.location.region || "Unknown",
          timezone: latestVisitor.location.timezone || "Unknown",
        } : {
          ipAddress: "Unknown",
          country: "Unknown",
          city: "Unknown",
          region: "Unknown",
          timezone: "Unknown",
        };
        
        
        if (user) {
          userRanking.push({
            rank: 0, // Will be set after sorting
            userid: userId,
            userDetails: {
              firstname: user.firstname || "Unknown",
              lastname: user.lastname || "Unknown",
              username: user.username || "",
              photolink: userComplete?.photoLink || user.photolink || "",
              gender: user.gender || "Unknown",
              country: user.country || "Unknown",
              isVip: user.isVip || false,
              creator_verified: user.creator_verified || false,
            },
            stats: {
              totalTimeSpent: activityData.totalTimeSpent,
              totalTimeSpentHours: parseFloat((activityData.totalTimeSpent / (1000 * 60 * 60)).toFixed(2)),
              totalPosts: activityData.totalPosts,
              totalActivities: activityData.totalActivities,
              activityBreakdown: activityData.activityBreakdown,
            },
            location: userLocation,
          });
        }
      } catch (err) {
        console.error(`Error fetching user ${userId}:`, err);
      }
    }

    // Sort by total time spent (descending) and assign ranks
    userRanking.sort((a, b) => b.stats.totalTimeSpent - a.stats.totalTimeSpent);
    userRanking.forEach((user, index) => {
      user.rank = index + 1;
    });

    // Paginate user ranking
    const userRankingTotal = userRanking.length;
    const userRankingStart = (userRankingPage - 1) * itemsPerPage;
    const userRankingEnd = userRankingStart + itemsPerPage;
    const paginatedUserRanking = userRanking.slice(userRankingStart, userRankingEnd);

    // Get visitors with user details (for visitors table)
    const visitorsWithDetails = [];
    for (const visitor of allVisitors) {
      let userDetails = null;
      if (visitor.userid && !visitor.isAnonymous) {
        try {
          const user = await userdb.findById(visitor.userid).exec();
          const userComplete = await completedb.findOne({ useraccountId: visitor.userid }).exec();
          if (user) {
            userDetails = {
              firstname: user.firstname || "Unknown",
              lastname: user.lastname || "Unknown",
              username: user.username || "",
              photolink: userComplete?.photoLink || user.photolink || "",
              gender: user.gender || "Unknown",
              country: user.country || "Unknown",
              isVip: user.isVip || false,
              creator_verified: user.creator_verified || false,
            };
          }
        } catch (err) {
          console.error(`Error fetching user for visitor ${visitor.userid}:`, err);
        }
      }

      const locationData = visitor.location ? {
        ipAddress: visitor.location.ipAddress || "Unknown",
        country: visitor.location.country || "Unknown",
        city: visitor.location.city || "Unknown",
        region: visitor.location.region || "Unknown",
        timezone: visitor.location.timezone || "Unknown",
      } : {
        ipAddress: "Unknown",
        country: "Unknown",
        city: "Unknown",
        region: "Unknown",
        timezone: "Unknown",
      };
      

      visitorsWithDetails.push({
        visitorId: visitor.visitorId,
        userid: visitor.userid || null,
        isAnonymous: visitor.isAnonymous || false,
        userDetails: userDetails,
        visitDate: visitor.lastVisit || visitor.firstVisit || visitor.date, // Use lastVisit for most recent visit time, fallback to firstVisit or date
        totalTimeSpent: visitor.totalTimeSpent || 0,
        totalTimeSpentHours: parseFloat(((visitor.totalTimeSpent || 0) / (1000 * 60 * 60)).toFixed(2)),
        pageViews: visitor.pageViews || 1,
        pagesVisited: (visitor.pagesVisited || []).slice().reverse(), // most recent first
        location: locationData,
        // Store raw lastVisit for sorting
        _lastVisit: visitor.lastVisit || visitor.firstVisit || visitor.date,
      });
    }

    // Sort visitors by most recent visit time (descending - newest first)
    visitorsWithDetails.sort((a, b) => {
      const dateA = new Date(a._lastVisit || a.visitDate).getTime();
      const dateB = new Date(b._lastVisit || b.visitDate).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    // Paginate visitors
    const visitorsTotal = visitorsWithDetails.length;
    const visitorsStart = (visitorsPage - 1) * itemsPerPage;
    const visitorsEnd = visitorsStart + itemsPerPage;
    const paginatedVisitors = visitorsWithDetails.slice(visitorsStart, visitorsEnd);

    // Calculate overall statistics
    const allSignUps = await userdb.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).exec();

    const totalSignUps = allSignUps.length;
    const totalMaleSignUps = allSignUps.filter(u => u.gender === "male" || u.gender === "Male").length;
    const totalFemaleSignUps = allSignUps.filter(u => u.gender === "female" || u.gender === "Female").length;
    const totalOtherSignUps = totalSignUps - totalMaleSignUps - totalFemaleSignUps;

    const totalTimeSpentAll = allVisitors.reduce((sum, v) => sum + (v.totalTimeSpent || 0), 0);
    const avgTimeSpentAll = totalVisitors > 0 ? totalTimeSpentAll / totalVisitors : 0;
    const avgTimeSpentAllHours = avgTimeSpentAll / (1000 * 60 * 60);

    const totalUserTimeSpentAll = allActivitiesInPeriod.reduce((sum, a) => sum + (a.totalTimeSpent || 0), 0);
    const totalActiveUsers = userRanking.length;
    const avgUserTimeSpentAll = totalActiveUsers > 0 ? totalUserTimeSpentAll / totalActiveUsers : 0;
    const avgUserTimeSpentAllHours = avgUserTimeSpentAll / (1000 * 60 * 60);

    // Get all posts in the period
    const allPosts = await postdata.find({
      $or: [
        {
          createdAt: { $gte: startDate, $lte: endDate },
        },
        {
          posttime: {
            $gte: startDate.getTime().toString(),
            $lte: endDate.getTime().toString(),
          },
        },
      ],
    }).exec();

    // Location tracking removed - no longer tracking location data

    // Find the day with most visitors
    const dayWithMostVisitors = dailyData.reduce((max, day) => 
      day.visitors.total > max.visitors.total ? day : max, 
      dailyData[0] || { visitors: { total: 0 } }
    );

    const analysis = {
      selectedPeriod: period,
      dailyData,
      userRanking: {
        data: paginatedUserRanking,
        pagination: {
          currentPage: userRankingPage,
          itemsPerPage: itemsPerPage,
          totalItems: userRankingTotal,
          totalPages: Math.ceil(userRankingTotal / itemsPerPage),
        },
      },
      visitors: {
        data: paginatedVisitors,
        pagination: {
          currentPage: visitorsPage,
          itemsPerPage: itemsPerPage,
          totalItems: visitorsTotal,
          totalPages: Math.ceil(visitorsTotal / itemsPerPage),
        },
      },
      summary: {
        totalVisitors, // Total visitors (not unique)
        totalSignUps,
        signUpsByGender: {
          male: totalMaleSignUps,
          female: totalFemaleSignUps,
          other: totalOtherSignUps,
        },
        avgTimeSpentHours: parseFloat(avgTimeSpentAllHours.toFixed(2)),
        totalActiveUsers: totalActiveUsers,
        avgUserTimeSpentHours: parseFloat(avgUserTimeSpentAllHours.toFixed(2)),
        totalPosts: allPosts.length,
        dayWithMostVisitors: {
          day: dayWithMostVisitors.day,
          dayNumber: dayWithMostVisitors.dayNumber,
          visitors: dayWithMostVisitors.visitors.total,
        },
      },
    };

    return res.status(200).json({
      ok: true,
      message: "Website analytics data retrieved successfully",
      data: analysis,
    });

  } catch (error) {
    console.error("Error getting website analytics:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to get website analytics data",
      error: error.message,
    });
  }
};

module.exports = getWebsiteAnalytics;
