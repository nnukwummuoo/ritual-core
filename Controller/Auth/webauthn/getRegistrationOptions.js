const { generateRegistrationOptions } = require("@simplewebauthn/server");
const { isoUint8Array } = require("@simplewebauthn/server/helpers");
const userdb = require("../../../Creators/userdb");
const { rpID, rpName } = require("../../../utiils/webauthnConfig");

// POST /webauthn/register/options — protected (verifyJWT sets req.userId)
const getRegistrationOptions = async (req, res) => {
  try {
    const user = await userdb.findById(req.userId).exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: isoUint8Array.fromUTF8String(user._id.toString()),
      userName: user.username || user._id.toString(),
      userDisplayName: `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.username,
      attestationType: "none",
      // Don't let someone register the same authenticator twice
      excludeCredentials: (user.webauthnCredentials || []).map((cred) => ({
        id: cred.credentialID,
        transports: cred.transports,
      })),
      authenticatorSelection: {
        // residentKey "required" is what makes this a true discoverable
        // passkey — the browser can find it without the user typing a
        // username first, which is what the login button relies on.
        residentKey: "required",
        userVerification: "preferred", // prefers biometrics/PIN, doesn't hard-require
        authenticatorAttachment: "platform", // phone/laptop biometrics, not a USB key
      },
    });

    user.currentWebauthnChallenge = options.challenge;
    await user.save();

    return res.status(200).json({ ok: true, options });
  } catch (err) {
    console.error("getRegistrationOptions error:", err);
    return res.status(500).json({ ok: false, message: "Could not start passkey registration" });
  }
};

module.exports = getRegistrationOptions;