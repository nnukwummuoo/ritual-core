const { verifyRegistrationResponse } = require("@simplewebauthn/server");
const userdb = require("../../../Creators/userdb");
const { rpID, expectedOrigins } = require("../../../utiils/webauthnConfig");

// POST /webauthn/register/verify — protected (verifyJWT sets req.userId)
const verifyRegistration = async (req, res) => {
  const { attestationResponse, deviceLabel } = req.body;

  if (!attestationResponse) {
    return res.status(400).json({ ok: false, message: "Missing attestation response" });
  }

  try {
    const user = await userdb.findById(req.userId).exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (!user.currentWebauthnChallenge) {
      return res.status(400).json({ ok: false, message: "No registration in progress. Please try again." });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: attestationResponse,
        expectedChallenge: user.currentWebauthnChallenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpID,
      });
    } catch (verifyErr) {
      console.error("verifyRegistrationResponse failed:", verifyErr);
      user.currentWebauthnChallenge = undefined;
      await user.save();
      return res.status(400).json({ ok: false, message: "Passkey registration could not be verified" });
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      user.currentWebauthnChallenge = undefined;
      await user.save();
      return res.status(400).json({ ok: false, message: "Passkey registration failed" });
    }

    const { credential } = registrationInfo;

    user.webauthnCredentials.push({
      credentialID: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: attestationResponse.response?.transports || [],
      deviceLabel: deviceLabel || "Passkey",
      createdAt: new Date(),
    });
    user.currentWebauthnChallenge = undefined;
    await user.save();

    return res.status(200).json({ ok: true, message: "Passkey added successfully" });
  } catch (err) {
    console.error("verifyRegistration error:", err);
    return res.status(500).json({ ok: false, message: "Could not complete passkey registration" });
  }
};

module.exports = verifyRegistration;