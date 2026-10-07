const admindb = require("../../Creators/admindb");
const { pushActivityNotification, pushAdminNotification } = require("../../utiils/sendPushnot");

const updateAdminNotification = async (req, res) => {
    const { 
        campaignId, // ID of one notification from the campaign
        title,
        message,
        hasLearnMore,
        learnMoreUrl
    } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ "ok": false, 'message': 'Authorization token required' });
    }

    if (!campaignId) {
        return res.status(400).json({ "ok": false, 'message': 'Campaign ID is required' });
    }

 if (!title || !message) {
        return res.status(400).json({ "ok": false, 'message': 'Title and message are required' });
    }

    if (title.length > 25) {
        return res.status(400).json({ "ok": false, 'message': 'Title must be 25 characters or fewer' });
    }

    if (message.length > 400) {
        return res.status(400).json({ "ok": false, 'message': 'Message must be 193 characters or fewer' });
    }

    try {
        // Find the campaign notification to get its details
        const sampleNotification = await admindb.findById(campaignId).exec();
        
        if (!sampleNotification || !sampleNotification.adminNotification) {
            return res.status(404).json({ "ok": false, 'message': 'Campaign not found' });
        }

   // Find all notifications from this campaign. Preferred: match by
        // batchId, stamped on every doc from the same send — exact, no
        // heuristics. Fallback: for notifications sent before batchId
        // existed, fall back to the old title/message/time-window match.
        let campaignNotifications;
        if (sampleNotification.batchId) {
            campaignNotifications = await admindb.find({
                adminNotification: true,
                batchId: sampleNotification.batchId
            }).exec();
        } else {
            const originalTitle = sampleNotification.title;
            const originalMessage = sampleNotification.message?.substring(0, 50);
            const targetGender = sampleNotification.targetGender || 'all';

            const startTime = new Date(sampleNotification.createdAt);
            startTime.setMinutes(startTime.getMinutes() - 1);
            const endTime = new Date(sampleNotification.createdAt);
            endTime.setMinutes(endTime.getMinutes() + 1);

            campaignNotifications = await admindb.find({
                adminNotification: true,
                title: originalTitle,
                message: { $regex: originalMessage },
                targetGender: targetGender,
                createdAt: { $gte: startTime, $lte: endTime }
            }).exec();
        }

        if (campaignNotifications.length === 0) {
            return res.status(404).json({ "ok": false, 'message': 'No notifications found in this campaign' });
        }

        // Update all notifications in the campaign
        const updateResult = await admindb.updateMany(
            { _id: { $in: campaignNotifications.map(n => n._id) } },
            { 
                $set: {
                    title: title,
                    message: message,
                    hasLearnMore: hasLearnMore || false,
                    learnMoreUrl: hasLearnMore ? (learnMoreUrl || null) : null,
                    updatedAt: new Date()
                }
            }
        );

        // Send push notifications to all users in the campaign if they were active
        if (sampleNotification.isActive) {
            let pushSuccessCount = 0;
            let pushFailureCount = 0;

            for (const notif of campaignNotifications) {
                if (notif.userid) {
                    try {
                        if (notif.type === 'admin_activity') {
                            await pushActivityNotification(notif.userid, message, "admin_activity");
                        } else {
                            await pushAdminNotification(notif.userid, message, title);
                        }
                        pushSuccessCount++;
                    } catch (pushError) {
                        console.log(`Failed to send push notification to user ${notif.userid}:`, pushError);
                        pushFailureCount++;
                    }
                }
            }

            return res.status(200).json({
                "ok": true,
                "message": `Notification campaign updated successfully`,
                "details": {
                    updatedCount: updateResult.modifiedCount,
                    pushNotifications: {
                        successful: pushSuccessCount,
                        failed: pushFailureCount
                    }
                }
            });
        }

        return res.status(200).json({
            "ok": true,
            "message": `Notification campaign updated successfully`,
            "details": {
                updatedCount: updateResult.modifiedCount
            }
        });

    } catch (err) {
        console.error('Error updating admin notification:', err);
        return res.status(500).json({ "ok": false, 'message': `Failed to update notification: ${err.message}` });
    }
};

module.exports = updateAdminNotification;

