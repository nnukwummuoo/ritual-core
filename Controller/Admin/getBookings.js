const requestdb = require("../../Creators/requsts");
const userdb = require("../../Creators/userdb");
const creatordb = require("../../Creators/creators");

/**
 * @desc Get all booking requests (platform-wide) for the admin Booking History page
 * @route GET /api/admin/bookings
 * Query params:
 *   page, limit
 *   status    - "request" | "accepted" | "completed" | "cancelled" | "declined" | "expired" | "all"
 *   hosttype  - "Fan meet" | "Fan date" | "Fan call" | "all"
 *   search    - matches booking ref, fan name, or creator name
 *   sortBy, sortOrder
 */
exports.getBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      hosttype,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};
    if (status && status !== "all") query.status = status;
    if (hosttype && hosttype !== "all") query.type = hosttype;

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Fetch everything matching status/hosttype first — search (which needs
    // resolved fan/creator names) is applied in-memory below, since a name
    // match can't be expressed as a query against the requests collection alone.
    const bookings = await requestdb.find(query).sort(sort).lean();

    const fanIds = [...new Set(bookings.map((b) => b.userid).filter(Boolean))];
    const creatorPortfolioIds = [...new Set(bookings.map((b) => b.creator_portfolio_id).filter(Boolean))];

    const [fans, creators] = await Promise.all([
      userdb.find({ _id: { $in: fanIds } }).select("_id firstname lastname username").lean(),
      creatordb.find({ _id: { $in: creatorPortfolioIds } }).select("_id name userid").lean(),
    ]);

    const fanMap = new Map(fans.map((f) => [f._id.toString(), f]));
    const creatorMap = new Map(creators.map((c) => [c._id.toString(), c]));

    let enriched = bookings.map((b) => {
      const fan = fanMap.get(String(b.userid));
      const creator = creatorMap.get(String(b.creator_portfolio_id));
      const fanName = fan
        ? (fan.firstname && fan.lastname ? `${fan.firstname} ${fan.lastname}` : fan.firstname || fan.username || "Unknown fan")
        : "Unknown fan";
      const creatorName = creator?.name || "Unknown creator";

      return {
        id: b._id,
        bookingRef: b.bookingRef || null,
        status: b.status,
        hosttype: b.type,
        date: b.date,
        time: b.time,
        place: b.place,
        price: b.price,
        userid: b.userid,
        creator_portfolio_id: b.creator_portfolio_id,
        creatorUserid: creator?.userid || null,
        fanName,
        creatorName,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        expiresAt: b.expiresAt,
      };
    });

    if (search) {
      const s = search.toLowerCase();
      enriched = enriched.filter(
        (b) =>
          (b.bookingRef || "").toLowerCase().includes(s) ||
          b.fanName.toLowerCase().includes(s) ||
          b.creatorName.toLowerCase().includes(s)
      );
    }

    const totalCount = enriched.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paged = enriched.slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      ok: true,
      bookings: paged,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.max(1, Math.ceil(totalCount / parseInt(limit))),
        totalCount,
      },
    });
  } catch (err) {
    console.error("Error fetching admin bookings:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};