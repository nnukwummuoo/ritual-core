const jwt = require("jsonwebtoken");
const { verifyAuthenticationResponse } = require("@simplewebauthn/server");
const { isoBase64URL } = require("@simplewebauthn/server/helpers");
const userdb = require("../../../Creators/userdb");
const { rpID, expectedOrigins } = require("../../../utiils/webauthnConfig");

// POST /webauthn/login/verify — public.
// Mirrors Controller/Auth/logins.js's token/cookie issuance exactly, so the
// frontend can reuse the same post-login handling for both password and
// biometric sign-in.
const verifyAuthentication = async (req, res) => {
  const { assertionResponse, challengeToken } = req.body;

  if (!assertionResponse || !challengeToken) {
    return res.status(400).json({ ok: false, message: "Missing biometric login data" });
  }

  let challenge;
  try {
    const decoded = jwt.verify(challengeToken, process.env.ACCESS_TOKEN_SECRET);
    challenge = decoded.challenge;
  } catch {
    return res.status(400).json({ ok: false, message: "Biometric login expired. Please try again." });
  }

  // userHandle is the base64url-encoded Mongo _id we embedded at registration
  const userHandle = assertionResponse.response?.userHandle;
  if (!userHandle) {
    return res.status(400).json({ ok: false, message: "This passkey isn't recognized" });
  }

  let userId;
  try {
    userId = isoBase64URL.toUTF8String(userHandle);
  } catch {
    return res.status(400).json({ ok: false, message: "This passkey isn't recognized" });
  }

  try {
    const user = await userdb.findById(userId).exec();
    if (!user) {
      return res.status(400).json({ ok: false, message: "This passkey isn't recognized" });
    }

    if (user.banned) {
      return res.status(403).json({
        ok: false,
        message: "This account has been banned for violating our rules",
        banned: true,
        banReason: user.banReason || "Violation of terms of service",
        bannedAt: user.bannedAt,
      });
    }

    const matchingCredential = (user.webauthnCredentials || []).find(
      (cred) => cred.credentialID === assertionResponse.id
    );

    if (!matchingCredential) {
      return res.status(400).json({ ok: false, message: "This passkey isn't recognized" });
    }

 // DIAGNOSTIC: confirms exactly what got read back from storage.
    // Safe to delete once login is confirmed working end to end.
    console.log(
      "[webauthn] stored credential — counter:", matchingCredential.counter,
      "publicKey type:", matchingCredential.publicKey?.constructor?.name,
      "publicKey length:", matchingCredential.publicKey?.length
    );

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge: challenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpID,
        credential: {
          id: matchingCredential.credentialID,
          // Buffer.from is more defensive than `new Uint8Array(...)` about
          // what Mongoose actually hands back for a Buffer-typed field
          // nested inside an array of subdocuments.
          publicKey: Buffer.from(matchingCredential.publicKey),
          counter: matchingCredential.counter,
          transports: matchingCredential.transports,
        },
      });
    } catch (verifyErr) {
      console.error("verifyAuthenticationResponse failed:", verifyErr);
      return res.status(400).json({ ok: false, message: "Biometric login could not be verified" });
    }

    if (!verification.verified) {
      return res.status(400).json({ ok: false, message: "Biometric login failed" });
    }

    // Persist the updated signature counter (replay-attack protection) and
    // bump lastUsedAt for display in Settings.
    matchingCredential.counter = verification.authenticationInfo.newCounter;
    matchingCredential.lastUsedAt = new Date();

    // ── Same token/cookie issuance as password login ──────────────────
    const refreshToken = jwt.sign(
      { UserInfo: { username: user.username, userId: user._id.toString(), isAdmin: user.admin } },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "30d" }
    );
    const accessToken = jwt.sign(
      { UserInfo: { username: user.username, userId: user._id.toString(), isAdmin: user.admin } },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "30d" }
    );

    user.refreshtoken = refreshToken;
    user.lastActive = new Date();
    await user.save();

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
      isVip: user.isVip || false,
      vipStartDate: user.vipStartDate || null,
      vipEndDate: user.vipEndDate || null,
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
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("verifyAuthentication error:", err);
    return res.status(500).json({ ok: false, message: "Something went wrong. Please try again." });
  }
};

module.exports = verifyAuthentication;