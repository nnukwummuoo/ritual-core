const messagedb = require("../../Creators/message");
const userdb = require("../../Creators/userdb");

/**
 * @desc Read-only view of the message history between a booking's fan and
 *       creator, for admin dispute/support review. Never sends messages.
 * @route GET /api/admin/bookings/conversation?fanUserid=...&creatorUserid=...
 */
exports.getBookingConversation = async (req, res) => {
  try {
    const { fanUserid, creatorUserid } = req.query;

    if (!fanUserid || !creatorUserid) {
      return res.status(400).json({ ok: false, message: "fanUserid and creatorUserid are required" });
    }

    // Message schema has no timestamps:true, so there's no createdAt field —
    // sort by _id instead, which embeds insertion order reliably.
    const messages = await messagedb
      .find({
        $or: [
          { fromid: fanUserid, toid: creatorUserid },
          { fromid: creatorUserid, toid: fanUserid },
        ],
      })
      .sort({ _id: 1 })
      .lean();

    const [fan, creator] = await Promise.all([
      userdb.findById(fanUserid).select("firstname lastname username").lean(),
      userdb.findById(creatorUserid).select("firstname lastname username").lean(),
    ]);

    return res.status(200).json({
      ok: true,
      fanName: fan ? (fan.firstname && fan.lastname ? `${fan.firstname} ${fan.lastname}` : fan.firstname || fan.username) : "Unknown fan",
      creatorName: creator ? (creator.firstname && creator.lastname ? `${creator.firstname} ${creator.lastname}` : creator.firstname || creator.username) : "Unknown creator",
      messages: messages.map((m) => ({
        id: m._id,
        fromid: m.fromid,
        toid: m.toid,
        content: m.content,
        date: m.date,
      })),
    });
  } catch (err) {
    console.error("Error fetching booking conversation:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};