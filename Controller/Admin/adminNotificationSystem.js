const crypto = require("crypto");
const userdb = require("../../Creators/userdb");
const admindb = require("../../Creators/admindb");
const { pushActivityNotification, pushAdminNotification } = require("../../utiils/sendPushnot");

const adminNotificationSystem = async (req, res) => {
    const { 
        message, 
        targetGender, 
        targetUserIds,
        notificationType = 'admin_broadcast',
        title = 'Admin Notification',
        hasLearnMore = false,
        learnMoreUrl = null
    } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!message) {
        return res.status(400).json({ "ok": false, 'message': 'Message is required' });
    }

    if (!title) {
        return res.status(400).json({ "ok": false, 'message': 'Title is required' });
    }

    // Learn More URL is optional - if hasLearnMore is true, it can be empty

    if (!token) {
        return res.status(401).json({ "ok": false, 'message': 'Authorization token required' });
    }

    try {
        let targetUsers = [];
        let filterDescription = '';

        // If specific user IDs are provided, use those
        if (targetUserIds && targetUserIds.length > 0) {
            const users = await userdb.find({ _id: { $in: targetUserIds } }).exec();
            targetUsers = users;
            filterDescription = `Specific users (${targetUserIds.length} IDs)`;
            // Mark targetGender as 'specific' for tracking
            req.body.targetGender = 'specific';
        } else {
            // Get users based on target audience filter
            let query = {};
            
            if (targetGender && targetGender !== 'all') {
                if (targetGender === 'creators') {
                    query.creator_verified = true;
                    filterDescription = 'All creators';
                } else {
                    query.gender = targetGender.toLowerCase();
                    filterDescription = `All ${targetGender} users`;
                }
            } else {
                filterDescription = 'All users';
            }
            
            targetUsers = await userdb.find(query).exec();
        }

        if (targetUsers.length === 0) {
            return res.status(404).json({ 
                "ok": false, 
                'message': 'No users found matching the criteria' 
            });
        }

const userIds = targetUsers.map(user => user._id);
        const notificationData = [];
        // Every per-user doc created by this send shares one batchId, so the
        // admin dashboard can group/edit/delete them as a single campaign
        // reliably, regardless of how long the insert takes or how many users
        // are targeted.
        const batchId = crypto.randomUUID();

        // Create notifications for all target users
        for (let i = 0; i < userIds.length; i++) {
            const notification = {
                userid: userIds[i],
                message: message,
                title: title,
                seen: false,
                type: notificationType,
                createdAt: new Date(),
                adminNotification: true,
                hasLearnMore: hasLearnMore,
                learnMoreUrl: learnMoreUrl,
                targetGender: (targetUserIds && targetUserIds.length > 0) ? 'specific' : targetGender,
                isActive: true, // New field to track if notification is still active
                batchId: batchId
            };

            notificationData.push(notification);
        }

        // First, deactivate all existing admin notifications
        await admindb.updateMany(
            { adminNotification: true, isActive: true },
            { isActive: false }
        );

        // Insert all new notifications
        await admindb.insertMany(notificationData);

        // Send push notifications based on type
        let pushSuccessCount = 0;
        let pushFailureCount = 0;

        for (let i = 0; i < userIds.length; i++) {
            try {
                if (notificationType === 'admin_activity') {
                    await pushActivityNotification(userIds[i], message, "admin_activity");
                } else {
                    await pushAdminNotification(userIds[i], message, title);
                }
                pushSuccessCount++;
            } catch (pushError) {
                console.log(`Failed to send push notification to user ${userIds[i]}:`, pushError);
                pushFailureCount++;
                // Continue with other users even if one push notification fails
            }
        }

        // Get gender breakdown for response
        const genderBreakdown = targetUsers.reduce((acc, user) => {
            acc[user.gender] = (acc[user.gender] || 0) + 1;
            return acc;
        }, {});

        return res.status(200).json({
            "ok": true,
            "message": `Notification sent successfully`,
            "details": {
                totalTargets: userIds.length,
                filterDescription: filterDescription,
                genderBreakdown: genderBreakdown,
                notificationType: notificationType,
                pushNotifications: {
                    successful: pushSuccessCount,
                    failed: pushFailureCount
                }
            }
        });

    } catch (err) {
        console.error('Error sending admin notification:', err);
        return res.status(500).json({ "ok": false, 'message': `Failed to send notification: ${err.message}` });
    }
};

module.exports = adminNotificationSystem;
