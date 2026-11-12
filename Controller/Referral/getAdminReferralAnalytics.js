const userdb = require("../../Creators/userdb");
const referraldb = require("../../Creators/referraldb");

/**
 * Admin endpoint to get referral analytics
 * Returns statistics about referrals and top referrers
 * Uses referraldb (actual rewards given) instead of referredBy count (includes fraud attempts)
 */
const getAdminReferralAnalytics = async (req, res) => {
    try {
        // Total users count
        const totalUsers = await userdb.countDocuments();

        // Count ACTUAL referrals (only those that resulted in rewards - excludes fraud)
        // These are records in referraldb with status 'completed' or 'paid'
        const actualReferrals = await referraldb.countDocuments({
            status: { $in: ['completed', 'paid'] }
        });

        // Users without legitimate referrals (organic + fraud attempts that didn't get rewards)
        const usersWithoutReferral = totalUsers - actualReferrals;

        // Calculate total gold spent on LEGITIMATE referrals only (1.7 gold per actual referral)
        const totalGoldSpent = actualReferrals * 50;

        // Get top referrers based on ACTUAL successful referrals
        // Count only completed/paid referrals from referraldb
        const referralCounts = await referraldb.aggregate([
            {
                $match: {
                    status: { $in: ['completed', 'paid'] }
                }
            },
            {
                $group: {
                    _id: '$referrerId',
                    actualReferralCount: { $sum: 1 }
                }
            },
            {
                $sort: { actualReferralCount: -1 }
            },
            {
                $limit: 100
            }
        ]);

        // Get user details for top referrers
        const topReferrers = await Promise.all(
            referralCounts.map(async (item, index) => {
                const user = await userdb.findById(item._id).select('username firstname lastname photolink rewardBalance');

                if (!user) return null;

                return {
                    rank: index + 1,
                    userId: item._id,
                    username: user.username || `${user.firstname} ${user.lastname}`,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    photolink: user.photolink,
                    referralCount: item.actualReferralCount, // Actual legitimate referrals only
                    rewardBalance: user.rewardBalance || 0,
                    totalEarned: item.actualReferralCount * 50, // gold
                };
            })
        );

        // Filter out null values (deleted users)
        const validReferrers = topReferrers.filter(r => r !== null);

        return res.status(200).json({
            ok: true,
            data: {
                overview: {
                    totalUsers,
                    usersWithReferral: actualReferrals, // Actual legitimate referrals
                    usersWithoutReferral,
                    totalGoldSpent,
                    percentageReferred: totalUsers > 0 ? ((actualReferrals / totalUsers) * 100).toFixed(2) : 0,
                },
                topReferrers: validReferrers,
            },
        });
    } catch (error) {
        console.error("❌ Error fetching admin referral analytics:", error);
        return res.status(500).json({
            ok: false,
            message: "Error fetching referral analytics",
            error: error.message,
        });
    }
};

module.exports = getAdminReferralAnalytics;
