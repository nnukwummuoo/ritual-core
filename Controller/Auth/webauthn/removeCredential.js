const userdb = require("../../../Creators/userdb");

// DELETE /webauthn/credentials/:credentialID — protected (verifyJWT sets req.userId)
const removeCredential = async (req, res) => {
  const { credentialID } = req.params;

  try {
    const user = await userdb.findById(req.userId).exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const before = user.webauthnCredentials.length;
    user.webauthnCredentials = user.webauthnCredentials.filter(
      (cred) => cred.credentialID !== credentialID
    );

    if (user.webauthnCredentials.length === before) {
      return res.status(404).json({ ok: false, message: "Passkey not found" });
    }

    await user.save();
    return res.status(200).json({ ok: true, message: "Passkey removed" });
  } catch (err) {
    console.error("removeCredential error:", err);
    return res.status(500).json({ ok: false, message: "Could not remove passkey" });
  }
};

module.exports = removeCredential;