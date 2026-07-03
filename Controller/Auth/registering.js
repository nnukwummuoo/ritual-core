//const {userdb} = require('../../Creator/userdb');
//const {connectdatabase} = require('../../config/connectDB');
//const { Query } = require('node-appwrite');
//const sdk = require("node-appwrite");
//const forgetHandler = require("../../helpers/sendemailAuth");
// const mongoose = require("mongoose");
// const userdb = require("../../Creators/userdb");
//const baneddb = require("../../Creators/admindb");
// const usercompletedb = require("../../Creators/usercomplete");
// let pushdb = require("../../Creators/settingsdb");

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const userdb = require("../../Creators/userdb");
const usercompletedb = require("../../Creators/usercomplete");
const pushdb = require("../../Creators/settingsdb");
const referraldb = require("../../Creators/referraldb");
const deviceIddb = require("../../Creators/deviceIddb");
const { generateReferralCode, rewardReferrer, checkHybridDeviceMatch } = require("../../helpers/referralHelpers");


const handleNewUser = async (req, res) => {
  console.log("Incoming registration payload:", req.body);

  const { firstname, lastname, gender, username, password, age, country, dob, secretPhrase, referralCode, deviceId, email } = req.body;

  // Validate required fields
  if (
    !firstname ||
    !lastname ||
    !gender ||
    !password ||
    !age ||
    !country ||
    !username ||
    !dob ||
    !secretPhrase ||
    !Array.isArray(secretPhrase) ||
    secretPhrase.length !== 12
  ) {
    return res.status(400).json({
      ok: false,
      message: "Registration not complete! All fields including 12-word secret phrase are required."
    });
  }

  // Check DB connection
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      ok: false,
      message: "Database not connected. Please try again later."
    });
  }

  try {
    // Ensure username is unique
    const existingUsername = await userdb.findOne({ username }).exec();
    if (existingUsername) {
      return res.status(400).json({
        ok: false,
        message: "Username already taken!"
      });
    }

    // 🔐 Hash password
    const hashPwd = await bcrypt.hash(password, 10);

    // 🔐 Hash secret phrase (join into one string before hashing)
    const phraseString = secretPhrase.join(" ");
    const hashSecretPhrase = await bcrypt.hash(phraseString, 10);

    // 🛡️ Anti-Abuse Gates
    let allowBonus = true;
    const currentIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

    // Gate 1: Hybrid Device ID Check (Persistent + Browser Fingerprint)
    // This is the STRONGEST anti-fraud check - combines file-based ID with browser fingerprint
    if (deviceId) {
      const matchResult = await checkHybridDeviceMatch(deviceId);
      if (matchResult.isMatch) {
        allowBonus = false;
      }
    } else {
      allowBonus = false; // Block bonus if no device ID is provided
    }

    // Gate 2: Email Similarity Check
    if (normalizedEmail) {
      const existingEmail = await userdb.exists({ normalizedEmail });
      if (existingEmail) {
        allowBonus = false;
        console.warn(`[Anti-Abuse] Email ${normalizedEmail} already exists. Bonus blocked.`);
      }
    }

    // Gate 3: IP Association Check (Strict: Only 1 account per IP)
    const ipCount = await userdb.countDocuments({
      lastLoginIP: currentIP
    });
    if (ipCount > 0) {
      allowBonus = false;
      console.warn(`[Anti-Abuse] IP ${currentIP} already has an existing account. Bonus blocked.`);
    }

    // 🎁 Handle referral code & Gate 4: Referral Velocity Check
    let referrerId = null;
    if (referralCode) {
      const referrer = await userdb.findOne({ referralCode }).exec();
      if (referrer) {
        referrerId = referrer._id.toString();

        // Gate 4: Referral Velocity Check
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const recentReferrals = await referraldb.countDocuments({
          referrerId: referrerId,
          createdAt: { $gte: oneDayAgo },
          status: 'completed' // Assuming 'completed' means successful bonus
        });

        if (recentReferrals > 50) {
          allowBonus = false;
          console.warn(`[Anti-Abuse] Referrer ${referrerId} has too many recent referrals (${recentReferrals}). Bonus blocked.`);
        }

        if (allowBonus) {
          console.log(`✅ Valid referral code: ${referralCode} from user ${referrerId}`);
        } else {
          console.log(`⚠️ Referral code ${referralCode} valid but bonus blocked due to abuse checks.`);
        }
      } else {
        console.log(`⚠️ Invalid referral code: ${referralCode}`);
      }
    }

    // Generate unique referral code for the new user
    const newUserReferralCode = await generateReferralCode();

    // Create tokens
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;

    const refreshToken = jwt.sign(
      { UserInfo: { username: username, userId: "", isAdmin: false } },
      refreshTokenSecret,
      { expiresIn: "7d" }
    );

    let accessToken = jwt.sign(
      { UserInfo: { username: username, userId: "", isAdmin: false } },
      accessTokenSecret,
      { expiresIn: "15m" }
    );

    // Create user in DB
    const user = await userdb.create({
      firstname,
      lastname,
      gender,
      username,
      password: hashPwd,
      secretPhraseHash: hashSecretPhrase,
      active: true,
      country,
      refreshtoken: refreshToken,
      accessToken,
      age,
      admin: false,
      passcode: "",
      balance: "0",
      dob,
      referralCode: newUserReferralCode,
      referredBy: allowBonus ? referrerId : null, // Only set referrer if bonus is allowed
      deviceId: deviceId, // Store device ID
      normalizedEmail: normalizedEmail,
      lastLoginIP: currentIP,
    });

    // Update access token with user ID
    accessToken = jwt.sign(
      { UserInfo: { username: username, userId: user._id.toString(), isAdmin: user.admin } },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
    user.accessToken = accessToken;
    await user.save();

    // 💾 Save device ID to deviceIddb (for anti-fraud checking)
    // This is saved separately to allow checking without loading full user records
    if (deviceId) {
      try {
        await deviceIddb.create({
          deviceId: deviceId,
        });
        console.log(`✅ Device ID saved to deviceIddb for user ${user._id}`);
      } catch (deviceError) {
        // If duplicate key error (device already exists), that's fine - it means it was already saved
        if (deviceError.code !== 11000) {
          console.error(`⚠️ Error saving device ID:`, deviceError);
        }
      }
    }

    // Create user profile + settings
    await usercompletedb.create({
      useraccountId: user._id.toString(),
      interestedIn: "Nothing",
      details: "Hey, I am using our platform",
    });

    await pushdb.create({
      emailnot: false,
      pushnot: true,
      userid: user._id.toString(),
    });

    // 🎁 Process referral reward
    // 🎁 Process referral reward & Sign-up Bonus
    if (allowBonus) {
      // Pay Referrer
      if (referrerId) {
        try {
          // Create referral record
          await referraldb.create({
            referrerId: referrerId,
            refereeId: user._id.toString(),
            status: 'completed',
            rewardAmount: 1.7,
            rewardType: 'gold',
          });

          // Reward the referrer
          await rewardReferrer(referrerId, 1.7);

          console.log(`✅ Referral bonus awarded to user ${referrerId}`);
        } catch (refError) {
          console.error(`⚠️ Error processing referral reward:`, refError);
        }
      }

    }



    return res.status(201).json({
      ok: true,
      message: "Registration successful!",
      bonusApplied: allowBonus,
      userId: user._id,
      // Do not return accessToken - user must log in to get tokens
    });
  } catch (err) {
    console.error("❌ Registration error:", err);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = handleNewUser;
