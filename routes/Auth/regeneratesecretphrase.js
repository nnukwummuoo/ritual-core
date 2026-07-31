const express = require('express');
const router = express.Router();
const verifyJwt = require('../../Middleware/verify');
const regenerateSecretPhrase = require('../../Controller/Auth/regeneratesecretphrase');

router.route('/')
  .post(verifyJwt, regenerateSecretPhrase);

module.exports = router;