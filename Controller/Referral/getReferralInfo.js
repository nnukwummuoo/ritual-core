const userdb = require("../../Creators/userdb");
const referraldb = require("../../Creators/referraldb");
const { generateReferralCode } = require("../../helpers/referralHelpers");

// Returns the user's referral code, balance, count and the list of friends they referred.
const getReferralInfo = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ ok: false, message: "Unauthorized" });
        }

        const user = await userdb.findById(userId).select("referralCode referralCount rewardBalance");
        if (!user) {
            return res.status(404).json({ ok: false, message: "User not found" });
        }

        // Existing users get a code the first time they open the page
        if (!user.referralCode) {
            user.referralCode = await generateReferralCode();
            await user.save();
        }

        const referrals = await referraldb
            .find({ referrerId: userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const referees = await userdb
            .find({ _id: { $in: referrals.map((r) => r.refereeId) } })
            .select("username createdAt")
            .lean();
        const refereeMap = new Map(referees.map((u) => [String(u._id), u]));

        const referralDetails = referrals.map((ref) => {
            const referee = refereeMap.get(String(ref.refereeId));
            return {
                id: ref._id,
                username: referee?.username || "Unknown",
                joinedAt: referee?.createdAt || ref.createdAt,
            };
        });

        return res.status(200).json({
            ok: true,
            data: {
                referralCode: user.referralCode,
                referralCount: user.referralCount || 0,
                rewardBalance: user.rewardBalance || 0,
                referrals: referralDetails,
            },
        });
    } catch (error) {
        console.error("❌ Error fetching referral info:", error);
        return res.status(500).json({
            ok: false,
            message: "Error fetching referral information",
            error: error.message,
        });
    }
};

module.exports = getReferralInfo;