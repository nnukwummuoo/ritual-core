const express = require("express");
const router = express.Router();
const verifyJWT = require("../../Middleware/verify");

const getRegistrationOptions = require("../../Controller/Auth/webauthn/getRegistrationOptions");
const verifyRegistration = require("../../Controller/Auth/webauthn/verifyRegistration");
const getAuthenticationOptions = require("../../Controller/Auth/webauthn/getAuthenticationOptions");
const verifyAuthentication = require("../../Controller/Auth/webauthn/verifyAuthentication");
const listCredentials = require("../../Controller/Auth/webauthn/listCredentials");
const removeCredential = require("../../Controller/Auth/webauthn/removeCredential");

// Setting up a passkey requires an existing logged-in session
router.post("/register/options", verifyJWT, getRegistrationOptions);
router.post("/register/verify", verifyJWT, verifyRegistration);

// Logging in with a passkey happens before there's a session
router.post("/login/options", getAuthenticationOptions);
router.post("/login/verify", verifyAuthentication);

// Managing existing passkeys from Settings
router.get("/credentials", verifyJWT, listCredentials);
router.delete("/credentials/:credentialID", verifyJWT, removeCredential);

module.exports = router;