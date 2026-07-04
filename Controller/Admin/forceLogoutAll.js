const { bumpSessionEpoch } = require("../../utiils/sessionEpoch");

const forceLogoutAll = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ ok: false, message: "Admin access required" });
    }

    const epoch = await bumpSessionEpoch();

    return res.status(200).json({
      ok: true,
      message: "All users have been logged out.",
      epoch,
    });
  } catch (err) {
    console.error("❌ Force logout all error:", err);
    return res.status(500).json({ ok: false, message: "Something went wrong. Please try again." });
  }
};

module.exports = forceLogoutAll;