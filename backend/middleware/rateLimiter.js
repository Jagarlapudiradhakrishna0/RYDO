const rateLimit = require('express-rate-limit');

/* =====================================================
   AUTHENTICATION RATE LIMITER
   Limits brute-force login and registration attempts
===================================================== */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth requests per window
  standardHeaders: true, // Return standard `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

/* =====================================================
   EMERGENCY SOS RATE LIMITER
   Protects emergency broadcast channels from flood spam
===================================================== */
const sosLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 SOS broadcasts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many emergency SOS triggers. Please wait a moment before sending another alert.',
  },
});

/* =====================================================
   GENERAL API RATE LIMITER
   General denial-of-service protection
===================================================== */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // Limit each IP to 600 API requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'API rate limit exceeded. Please throttle your requests.',
  },
});

module.exports = {
  authLimiter,
  sosLimiter,
  generalLimiter,
};
