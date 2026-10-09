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

    // DIAGNOSTIC: confirms exactly what this installed version returns here.
    // Safe to delete once registration is confirmed working end to end.
    console.log("[webauthn] registrationInfo top-level keys:", Object.keys(registrationInfo));
    if (registrationInfo.credential) {
      console.log("[webauthn] registrationInfo.credential keys:", Object.keys(registrationInfo.credential));
    }

    // @simplewebauthn/server changed this response shape across major
    // versions: newer versions nest fields under registrationInfo.credential
    // (credential.id / credential.publicKey / credential.counter), older
    // versions return them flat on registrationInfo itself (credentialID /
    // credentialPublicKey / counter). Handle both so this doesn't silently
    // break again on a version bump either direction.
    let credentialID = registrationInfo.credential?.id ?? registrationInfo.credentialID;
    const credentialPublicKey =
      registrationInfo.credential?.publicKey ?? registrationInfo.credentialPublicKey;
    const counter = registrationInfo.credential?.counter ?? registrationInfo.counter ?? 0;

    if (!credentialID || !credentialPublicKey) {
      console.error(
        "[webauthn] Unrecognized registrationInfo shape — neither registrationInfo.credential.* nor the flat fields were found. Full object:",
        JSON.stringify(registrationInfo, (_k, v) => (v instanceof Uint8Array ? `Uint8Array(${v.length})` : v))
      );
      user.currentWebauthnChallenge = undefined;
      await user.save();
      return res.status(500).json({
        ok: false,
        message: "Server couldn't read the passkey response — check backend logs for '[webauthn] Unrecognized registrationInfo shape'.",
      });
    }

    // Older package versions return credentialID as a raw Buffer rather
    // than a base64url string — normalize so it matches what we compare
    // against on login (assertionResponse.id, which is always a string).
    if (Buffer.isBuffer(credentialID) || credentialID instanceof Uint8Array) {
      credentialID = Buffer.from(credentialID).toString("base64url");
    }

    user.webauthnCredentials.push({
      credentialID,
      publicKey: Buffer.from(credentialPublicKey),
      counter,
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