const jwt = require("jsonwebtoken");
const { generateAuthenticationOptions } = require("@simplewebauthn/server");
const { rpID } = require("../../../utiils/webauthnConfig");

// POST /webauthn/login/options — public. No username required: this is a
// discoverable/"usernameless" flow, so allowCredentials is left empty and
// the browser lets the person pick from any passkey it has for this site.
//
// There's no logged-in user yet at this point, so the challenge can't be
// stored on a user document. Instead it's signed into a short-lived token
// (2 min) that the client echoes back on /webauthn/login/verify — avoids
// needing a separate server-side session store for an unauthenticated step.
const getAuthenticationOptions = async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    const challengeToken = jwt.sign(
      { challenge: options.challenge },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "2m" }
    );

    return res.status(200).json({ ok: true, options, challengeToken });
  } catch (err) {
    console.error("getAuthenticationOptions error:", err);
    return res.status(500).json({ ok: false, message: "Could not start biometric login" });
  }
};

module.exports = getAuthenticationOptions;