const jwt = require("jsonwebtoken");
require("dotenv").config();

const verifyJwtBody = (req, res, next) => {
  let token = req.body.token;

  if (!token) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.userId = decoded.UserInfo.userId;
    req.isAdmin = decoded.UserInfo.isAdmin;
    next();
  } catch (err) {
    return res.status(403).json({
      message: "Token verification failed. Please log in again.",
      code: "TOKEN_INVALID",
    });
  }
};

module.exports = verifyJwtBody;