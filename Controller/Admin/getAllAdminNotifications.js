const admindb = require("../../Creators/admindb");
const userdb = require("../../Creators/userdb");

const getAllAdminNotifications = async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ "ok": false, 'message': 'Authorization token required' });
    }

    try {
        // Get all admin notifications
        const notifications = await admindb
            .find({ adminNotification: true })
            .sort({ createdAt: -1 })
            .exec();

        // Group notifications into campaigns.
        // Preferred path: group by batchId (one send = one batchId, stamped on
        // every per-user doc at creation time) — this is exact and O(n).
        // Legacy fallback: notifications created before batchId existed don't
        // have one, so each is kept as its own single-recipient campaign
        // instead of re-running the old, fragile title/message/time-window scan.
        const campaigns = {};

        for (const notif of notifications) {
            const campaignKey = notif.batchId || `legacy_${notif._id}`;

            if (!campaigns[campaignKey]) {
                campaigns[campaignKey] = {
                    _id: notif._id, // first notification seen in this batch
                    title: notif.title,
                    message: notif.message,
                    targetGender: notif.targetGender || 'all',
                    isSpecificUsers: notif.targetGender === 'specific',
                    hasLearnMore: notif.hasLearnMore || false,
                    learnMoreUrl: notif.learnMoreUrl || null,
                    isActive: false,
                    type: notif.type || 'admin_broadcast',
                    createdAt: notif.createdAt,
                    updatedAt: notif.updatedAt,
                    totalSent: 0,
                    targetUserIds: [],
                    users: []
                };
            }

            const campaign = campaigns[campaignKey];
            campaign.isActive = campaign.isActive || !!notif.isActive;
            campaign.totalSent += 1;
            if (notif.userid) campaign.targetUserIds.push(notif.userid);
            if (new Date(notif.updatedAt) > new Date(campaign.updatedAt)) {
                campaign.updatedAt = notif.updatedAt;
            }
            if (new Date(notif.createdAt) < new Date(campaign.createdAt)) {
                campaign.createdAt = notif.createdAt;
            }
        }

        const campaignList = Object.values(campaigns);

        // De-dupe target user ids per campaign
        campaignList.forEach((c) => {
            c.targetUserIds = [...new Set(c.targetUserIds)];
        });

        // Fetch every targeted user across all campaigns in a single query
        // instead of one query per campaign (avoids an N+1 slowdown as the
        // number of campaigns grows).
        const allUserIds = [...new Set(campaignList.flatMap((c) => c.targetUserIds))];
        const users = allUserIds.length > 0
            ? await userdb.find({ _id: { $in: allUserIds } })
                .select('firstname lastname username photolink gender creator_verified')
                .exec()
            : [];

        const usersById = new Map(users.map((u) => [u._id.toString(), {
            _id: u._id,
            name: `${u.firstname} ${u.lastname}`,
            username: u.username,
            photolink: u.photolink,
            gender: u.gender,
            creator_verified: u.creator_verified
        }]));

        campaignList.forEach((c) => {
            c.users = c.targetUserIds
                .map((id) => usersById.get(id.toString()))
                .filter(Boolean);
        });

        return res.status(200).json({
            "ok": true,
            "campaigns": campaignList,
            "total": campaignList.length
        });

    } catch (err) {
        console.error('Error getting admin notifications:', err);
        return res.status(500).json({ "ok": false, 'message': `Failed to get notifications: ${err.message}` });
    }
};

module.exports = getAllAdminNotifications;