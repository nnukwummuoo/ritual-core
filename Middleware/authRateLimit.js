const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Too many login attempts. Please try again in a few minutes.",
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per IP per hour — secret phrase guessing is the concern
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Too many password reset attempts. Please try again later.",
  },
});

module.exports = { loginLimiter, forgotPasswordLimiter };