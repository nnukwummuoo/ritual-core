const userdb = require("../../Creators/userdb");
const messagedb = require("../../Creators/message"); // Verify this path matches getcurrentChat.js require
const completedb = require("../../Creators/usercomplete");
const postdb = require("../../Creators/post");
const likedb = require("../../Creators/like");
const followdb = require("../../Creators/followers");
const { pushMessageNotification, pushAdminNotification } = require("../../utiils/sendPushnot");
const sendEmail = require("../../utiils/sendEmailnot");
const admindb = require("../../Creators/admindb");
const balancehistorydb = require("../../Creators/mainbalance");


// 4. User Updates PPV Settings (Price/Toggle)
const updatePPVSettings = async (req, res) => {
    const { price, enabled } = req.body;
    const userid = req.userId; // from the verified token, never from the request body

    if (!userid) {
        return res.status(400).json({ ok: false, message: "User ID required" });
    }

    try {
        const user = await userdb.findById(userid);
        if (!user) {
            return res.status(404).json({ ok: false, message: "User not found" });
        }

        if (!user.creator_verified) {
            return res.status(403).json({ ok: false, message: "PPV is available to verified creators only" });
        }

        if (price !== undefined) {
            if (!Number.isFinite(Number(price)) || Number(price) < 1) {
                return res.status(400).json({ ok: false, message: "Minimum price is 1 Gold" });
            }
            user.ppvPrice = Number(price);
        }
        if (enabled !== undefined) user.ppvEnabled = Boolean(enabled);

        await user.save();

        return res.status(200).json({ ok: true, message: "Settings updated", ppvPrice: user.ppvPrice, ppvEnabled: user.ppvEnabled });

    } catch (error) {
        console.error("Error updating PPV settings:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
};

// 5. Unlock Message
const unlockMessage = async (req, res) => {
    const { messageid } = req.body;
    const userid = req.userId; // the one PAYING (viewer), from the verified token

    if (!userid || !messageid) {
        return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    try {
        const message = await messagedb.findById(messageid);
        if (!message) {
            return res.status(404).json({ ok: false, message: "Message not found" });
        }

        if (!message.isPPV) {
            return res.status(400).json({ ok: false, message: "Not a PPV message" });
        }

        // Check if unlocked
        if (message.unlockedBy.includes(userid)) {
            return res.status(200).json({ ok: true, message: "Already unlocked", content: message.content, files: message.files });
        }

        // Check if user is the sender 
        if (message.fromid === userid) {
            return res.status(200).json({ ok: true, message: "You are the sender", content: message.content, files: message.files });
        }

        const viewer = await userdb.findById(userid);
        if (!viewer) return res.status(404).json({ ok: false, message: "Viewer not found" });

        const price = message.ppvPrice;
        const currentBalance = parseFloat(viewer.balance || "0");

        if (currentBalance < price) {
            return res.status(400).json({ ok: false, message: `Insufficient balance. You need ${price} gold.`, code: "INSUFFICIENT_FUNDS" });
        }

        // Deduct from Viewer
        const newViewerBalance = currentBalance - price;
        viewer.balance = newViewerBalance.toString();
        await viewer.save();

        // Credit Creator (Sender)
        const sender = await userdb.findById(message.fromid);
        if (sender) {
            const currentSenderBalance = parseFloat(sender.balance || "0");

            sender.balance = (currentSenderBalance + price).toString();
            sender.earnings = (sender.earnings || 0) + price;

            await sender.save();

            // Create Transaction History & Notifications
            const date = Date.now().toString();

            // 1. Transaction for Viewer (Buyer)
            await balancehistorydb.create({
                userid: userid,
                details: `Purchased PPV message from ${sender.username || sender.firstname}`,
                spent: price.toString(),
                date: date
            });

            // 2. Transaction for Sender (Seller)
            await balancehistorydb.create({
                userid: message.fromid,
                details: `Earning from PPV message sale to ${viewer.username || viewer.firstname}`,
                income: price.toString(),
                date: date
            });

            // 3. Database Notification for Sender
            await admindb.create({
                userid: message.fromid,
                message: `${viewer.username || viewer.firstname} purchased your PPV message`,
                seen: false
            });

            // 4. Send Push Notification to Sender
            await pushMessageNotification(
                message.fromid,
                `${viewer.username || viewer.firstname} purchased your PPV message`,
                viewer.username || viewer.firstname
            );
        }

        // Mark as unlocked
        message.unlockedBy.push(userid);
        await message.save();

        return res.status(200).json({ ok: true, message: "Message unlocked successfully", content: message.content, files: message.files });

    } catch (error) {
        console.error("Error unlocking message:", error);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
}

module.exports = {
    updatePPVSettings,
    unlockMessage
};
