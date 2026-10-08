// WebAuthn / Passkey relying-party configuration.
//
// IMPORTANT — WebAuthn ties credentials to a specific domain (the "RP ID").
// A passkey registered while rpID = "mmeko.com" will NOT work on a
// different registrable domain (e.g. a Vercel preview URL). That isn't a
// bug — it's the security model. For local development, override both
// env vars below:
//   WEBAUTHN_RP_ID=localhost
//   WEBAUTHN_ORIGIN=http://localhost:3000
//
// Keep this list in sync with the `allowedOrigins` array in index.js.
const rpID = process.env.WEBAUTHN_RP_ID || "mmeko.com";
const rpName = process.env.WEBAUTHN_RP_NAME || "Mmeko";

const expectedOrigins = [
  process.env.WEBAUTHN_ORIGIN,
  "https://mmeko.com",
  "https://www.mmeko.com",
  "https://mmekowebsite-mu.vercel.app",
].filter(Boolean);

module.exports = { rpID, rpName, expectedOrigins };