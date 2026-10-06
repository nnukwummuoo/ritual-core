const userdb = require("../../Creators/userdb");
const admindb = require("../../Creators/admindb");

const getNotificationDetails = async (req, res) => {
    const { notificationId, userid } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!notificationId) {
        return res.status(400).json({ "ok": false, 'message': 'Notification ID is required' });
    }

    if (!userid) {
        return res.status(400).json({ "ok": false, 'message': 'User ID is required' });
    }

    if (!token) {
        return res.status(401).json({ "ok": false, 'message': 'Authorization token required' });
    }

    try {
        console.log('🔍 getNotificationDetails: Request received', {
            notificationId,
            userid,
            hasToken: !!token
        });

        // Get user info to verify access
        const user = await userdb.findById(userid).exec();
        if (!user) {
            console.log('❌ getNotificationDetails: User not found:', userid);
            return res.status(404).json({ "ok": false, 'message': 'User not found' });
        }

        console.log('✅ getNotificationDetails: User found:', user.firstname, user.lastname);

      // Get the notification details for this specific user.
        // Note: isActive is intentionally NOT filtered here — a notification is only
        // "active" while it's the current admin broadcast (for the popup). Once a newer
        // broadcast is sent, older ones become inactive but remain in the user's
        // notification feed, and "Learn more" must still work for them.
        const notification = await admindb.findOne({
            _id: notificationId,
            adminNotification: true,
            userid: userid // Look for notification specifically created for this user
        }).exec();

        console.log('🔍 getNotificationDetails: Query result:', {
            found: !!notification,
            notificationId: notification?._id,
            title: notification?.title
        });

        if (!notification) {
            console.log('❌ getNotificationDetails: Notification not found for user');
            return res.status(404).json({ 
                "ok": false, 
                "success": false,
                "message": "Notification not found or access denied" 
            });
        }

        console.log('✅ getNotificationDetails: Notification found, preparing response');

        return res.status(200).json({
            "ok": true,
            "success": true,
            "notification": {
                _id: notification._id,
                title: notification.title,
                message: notification.message,
                fullContent: notification.learnMoreUrl || notification.message, // Use learnMoreUrl as fullContent
                createdAt: notification.createdAt,
                hasLearnMore: notification.hasLearnMore || false,
                learnMoreUrl: notification.learnMoreUrl || null
            }
        });

    } catch (err) {
        console.error('Error fetching notification details:', err);
        return res.status(500).json({ "ok": false, 'message': `Failed to fetch notification details: ${err.message}` });
    }
};

module.exports = getNotificationDetails;
