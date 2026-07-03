const userdb = require("../../Creators/userdb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const forgetpass = async (req, res) => {
  const { username, secretPhrase, newPassword } = req.body;

  if (!username || !secretPhrase || !newPassword) {
    return res.status(400).json({
      ok: false,
      message: "Username, secret phrase and new password are required!",
    });
  }

  if (!Array.isArray(secretPhrase) || secretPhrase.length !== 12) {
    return res.status(400).json({
      ok: false,
      message: "Secret phrase must be 12 words",
    });
  }

  try {
    // 1️⃣ Find user
    const user = await userdb.findOne({ username }).exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    // 2️⃣ Verify secret phrase
    const phraseString = secretPhrase.join(" ");
    const isPhraseValid = await bcrypt.compare(
      phraseString,
      user.secretPhraseHash
    );

    if (!isPhraseValid) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid secret phrase" });
    }

    // 3️⃣ Update password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;

    // 4️⃣ Generate new tokens
    const refreshToken = jwt.sign(
      { UserInfo: { username: user.username } },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    const accessToken = jwt.sign(
      { UserInfo: { username: user.username, userId: user._id.toString() } },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    user.refreshtoken = refreshToken;
    user.accessToken = accessToken;
    await user.save();

    // 5️⃣ Set cookies
    res.cookie("auth_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      ok: true,
      message: "Password updated successfully",
      accessToken,
    });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = forgetpass;
