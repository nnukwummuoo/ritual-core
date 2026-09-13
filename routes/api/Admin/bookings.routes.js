const express = require("express");
const router = express.Router();
const { getBookings } = require("../../../Controller/Admin/getBookings");
const { getBookingConversation } = require("../../../Controller/Admin/getBookingConversation");
const verifyJwt = require("../../../Middleware/verify");
const isAdmin = require("../../../Middleware/isAdmin");

// Apply authentication and admin middleware to all routes
router.use(verifyJwt);
router.use(isAdmin);

// Get all bookings with filtering/search/pagination
router.get("/", getBookings);

// Read-only conversation between a booking's fan and creator
router.get("/conversation", getBookingConversation);

module.exports = router;