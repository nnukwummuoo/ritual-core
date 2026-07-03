const express = require('express')
const router = express.Router();
const deletepro = require('../../../Controller/profile/deleteAccount');
const blockedusers = require('../../../Controller/profile/getBlockedacc');
const removeblockeduser = require('../../../Controller/profile/deleteblockUser');
const verifyJwt = require('../../../Middleware/verify');

router.route('/')
.delete(verifyJwt, deletepro)
.put(blockedusers)
.patch(removeblockeduser)


module.exports = router;