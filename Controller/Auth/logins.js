const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getSessionEpoch } = require("../../utiils/sessionEpoch");
const userdb = require("../../Creators/userdb");
require("dotenv").config();
const handleLogin = async (req, res) => {
  const { username, password } = req.body;


  // Validate required fields
  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      message: "Username and password are required.",
    });
  }

  const normalizedUsername = username.toLowerCase().trim();

  try {
    // Find user by username
    const user = await userdb.findOne({ username: normalizedUsername }).exec();

    if (!user) {
      return res.status(400).json({
        ok: false,
        message: "Invalid username or password.",
      });
    }

    // Check if user is banned
    if (user.banned) {
      return res.status(403).json({
        ok: false,
        message: "This account has been banned for violating our rules",
        banned: true,
        banReason: user.banReason || "Violation of terms of service",
        bannedAt: user.bannedAt
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      // Create tokens
      const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
      const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;

      const sessionEpoch = await getSessionEpoch();

      const refreshToken = jwt.sign(
        { UserInfo: { username: user.username, userId: user._id.toString(), isAdmin: user.admin, sessionEpoch } },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "30d" }
      );

      const accessToken = jwt.sign(
        { UserInfo: { username: user.username, userId: user._id.toString(), isAdmin: user.admin, sessionEpoch } },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "30d" }
      );
      // Update user's refresh token and lastActive
      user.refreshtoken = refreshToken;
      user.lastActive = new Date();
      await user.save();
      // await fixUserFields();

      // Set cookies
      res.cookie("auth_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      return res.status(200).json({
        ok: true,
        message: "Login Success",
        isAdmin: user.admin,
        userId: user._id,
        accessToken,
        token: refreshToken,
        // Include VIP status
        isVip: user.isVip || false,
        vipStartDate: user.vipStartDate || null,
        vipEndDate: user.vipEndDate || null,
        // Include all user information
        user: {
          _id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          username: user.username,
          bio: user.bio,
          photolink: user.photolink,
          photoID: user.photoID,
          gender: user.gender,
          age: user.age,
          country: user.country,
          dob: user.dob,
          balance: user.balance,
          withdrawbalance: user.withdrawbalance,
          coinBalance: user.coinBalance,
          earnings: user.earnings,
          pending: user.pending,
          creator_verified: user.creator_verified,
          creator_portfolio: user.creator_portfolio,
          creator_portfolio_id: user.creator_portfolio_id,
          Creator_Application_status: user.Creator_Application_status,
          fan_verified: user.fan_verified || false,
fan_application_status: user.fan_application_status || "none",
          followers: user.followers,
          following: user.following,
          isVip: user.isVip,
          vipStartDate: user.vipStartDate,
          vipEndDate: user.vipEndDate,
          vipAutoRenewal: user.vipAutoRenewal,
          vipCelebrationViewed: user.vipCelebrationViewed,
          active: user.active,
          admin: user.admin,
          passcode: user.passcode,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } else {
      return res.status(401).json({
        ok: false,
        message: "Invalid username or password.",
      });
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = handleLogin;

// update all user
// async function fixUserFields() {
//   try {
//     const result = await userdb.updateMany(
//       {},
//       {
//         $set: {
//           Creator_Application_status: "none",
//           Creator_Application: false,
//         },
//         $unset: {
//           Creator_Applicatio_status: "",
//         },
//       },
//       { upsert: false }
//     );
//     console.log("Users updated:", result.modifiedCount);
//   } catch (err) {
//     console.error("Error updating users:", err);
//   }
// }
