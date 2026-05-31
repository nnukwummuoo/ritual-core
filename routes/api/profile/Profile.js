const express = require('express')
const router = express.Router();
const getprofile = require('../../../Controller/profile/getprofile');
const profile = require('../../../Controller/profile/getprofilebyID')
// const verifyJwt = require('../../../Middleware/verify');

router.route('/')
.post(getprofile)
.patch(profile)



module.exports = router;
