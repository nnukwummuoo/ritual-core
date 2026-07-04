const jwt = require("jsonwebtoken");
require("dotenv").config();

const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60; // 30 days — must match logins.js expiresIn
const REFRESH_THRESHOLD_SECONDS = TOKEN_LIFETIME_SECONDS / 2; // reissue once under 15 days remain

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.userId = decode.UserInfo.userId;
    req.isAdmin = decode.UserInfo.isAdmin;

    // Sliding expiration: silently reissue a fresh 30-day token once this one
    // is past the halfway point of its life, so active users never hit a hard expiry.
    const remaining = decode.exp - Math.floor(Date.now() / 1000);
    if (remaining < REFRESH_THRESHOLD_SECONDS) {
      const newToken = jwt.sign(
        { UserInfo: decode.UserInfo },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "30d" }
      );
      res.setHeader("X-New-Access-Token", newToken);
      res.setHeader("Access-Control-Expose-Headers", "X-New-Access-Token");
    }

    next();
  } catch (err) {
    return res.status(403).json({
      message: "Token verification failed. Please log in again.",
      code: "TOKEN_INVALID",
    });
  }
};

module.exports = verifyJwt;