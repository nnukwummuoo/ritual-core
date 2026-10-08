const userdb = require("../../../Creators/userdb");

// GET /webauthn/credentials — protected (verifyJWT sets req.userId)
const listCredentials = async (req, res) => {
  try {
    const user = await userdb.findById(req.userId).select("webauthnCredentials").exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const credentials = (user.webauthnCredentials || []).map((cred) => ({
      credentialID: cred.credentialID,
      deviceLabel: cred.deviceLabel,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
    }));

    return res.status(200).json({ ok: true, credentials });
  } catch (err) {
    console.error("listCredentials error:", err);
    return res.status(500).json({ ok: false, message: "Could not load passkeys" });
  }
};

module.exports = listCredentials;