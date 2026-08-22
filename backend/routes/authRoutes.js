const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

/* =====================================================
   PASSWORD HASHING HELPERS (Node.js crypto)
===================================================== */

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function verifyPassword(password, salt, storedHash) {
  const hash = hashPassword(password, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}

/* =====================================================
   NORMALIZATION & VALIDATION HELPERS
===================================================== */

const VALID_BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

function normalizeBikeNumber(raw) {
  if (!raw) return '';
  // Remove all non-alphanumeric chars and uppercase
  const clean = String(raw).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  // Standard Indian vehicle format: State(2) + District(2) + Series(1-3) + Number(4)
  // e.g. TS09AB1234 -> TS 09 AB 1234
  if (clean.length >= 8 && clean.length <= 11) {
    const match = clean.match(/^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
  }
  return clean;
}

function isValidBikeNumber(raw) {
  if (!raw) return false;
  const clean = String(raw).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  // Allow 6 to 12 alphanumeric characters
  return clean.length >= 6 && clean.length <= 12;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).trim().toLowerCase());
}

function normalizePhoneNumber(raw) {
  if (!raw) return '';
  // Remove spaces, hyphens, parentheses
  let digits = String(raw).replace(/[^0-9+]/g, '');
  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  return digits;
}

function isValidIndianPhone(raw) {
  const digits = normalizePhoneNumber(raw);
  // Standard Indian mobile number is 10 digits starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(digits);
}

/* =====================================================
   TEST ENDPOINT
   GET /api/auth/test
===================================================== */

router.get('/test', (req, res) => {
  return res.json({
    success: true,
    message: 'Auth route is working',
  });
});

/* =====================================================
   REGISTER USER
   POST /api/auth/register
===================================================== */

router.post('/register', async (req, res) => {
  console.log('RYDO: POST /api/auth/register HIT');

  try {
    const {
      name,
      phoneNumber,
      bikeNumber,
      email,
      bloodGroup,
      nativePlace,
      emergencyContactName,
      emergencyContactPhone,
      password,
      confirmPassword,
      emergencyContactConsent,
      profilePhoto,
    } = req.body;

    /* -------------------------------------------------
       VALIDATION: NAME
    ------------------------------------------------- */

    const trimmedName = String(name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your full name (at least 2 characters).',
      });
    }

    /* -------------------------------------------------
       VALIDATION: USER'S OWN PHONE NUMBER
    ------------------------------------------------- */

    if (!phoneNumber || !isValidIndianPhone(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number for your account.',
      });
    }
    const formattedUserPhone = '+91' + normalizePhoneNumber(phoneNumber);

    /* -------------------------------------------------
       VALIDATION: BIKE NUMBER
    ------------------------------------------------- */

    if (!bikeNumber || !isValidBikeNumber(bikeNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid bike registration number (e.g. TS 09 AB 1234).',
      });
    }
    const formattedBikeNumber = normalizeBikeNumber(bikeNumber);

    /* -------------------------------------------------
       VALIDATION: EMAIL
    ------------------------------------------------- */

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    // Check if email is already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please login.',
      });
    }

    /* -------------------------------------------------
       VALIDATION: BLOOD GROUP
    ------------------------------------------------- */

    const normalizedBloodGroup = String(bloodGroup || '').trim().toUpperCase();
    if (!VALID_BLOOD_GROUPS.includes(normalizedBloodGroup)) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid blood group (${VALID_BLOOD_GROUPS.join(', ')}).`,
      });
    }

    /* -------------------------------------------------
       VALIDATION: NATIVE PLACE
    ------------------------------------------------- */

    const trimmedNativePlace = String(nativePlace || '').trim();
    if (!trimmedNativePlace) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your native place or city.',
      });
    }

    /* -------------------------------------------------
       VALIDATION: EMERGENCY CONTACT
    ------------------------------------------------- */

    const trimmedEmName = String(emergencyContactName || '').trim();
    if (!trimmedEmName) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the name of your emergency contact.',
      });
    }

    if (!emergencyContactPhone || !isValidIndianPhone(emergencyContactPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit emergency contact phone number.',
      });
    }
    const formattedEmPhone = '+91' + normalizePhoneNumber(emergencyContactPhone);

    /* -------------------------------------------------
       VALIDATION: CONSENT
    ------------------------------------------------- */

    if (!emergencyContactConsent) {
      return res.status(400).json({
        success: false,
        message: 'You must agree to allow RYDO to use your emergency contact for safety and SOS alerts.',
      });
    }

    /* -------------------------------------------------
       VALIDATION: PASSWORD
    ------------------------------------------------- */

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match. Please re-enter your password.',
      });
    }

    /* -------------------------------------------------
       SECURE PASSWORD HASHING
    ------------------------------------------------- */

    const passwordSalt = generateSalt();
    const passwordHash = hashPassword(password, passwordSalt);

    /* -------------------------------------------------
       CREATE USER
    ------------------------------------------------- */

    const newUser = await User.create({
      name: trimmedName,
      phoneNumber: formattedUserPhone,
      bikeNumber: formattedBikeNumber,
      email: normalizedEmail,
      bloodGroup: normalizedBloodGroup,
      nativePlace: trimmedNativePlace,
      emergencyContact: {
        name: trimmedEmName,
        phoneNumber: formattedEmPhone,
      },
      emergencyContactConsent: true,
      emergencyContactConsentAt: new Date(),
      passwordHash,
      passwordSalt,
      profilePhoto: profilePhoto || null,
    });

    console.log('RYDO: User registered successfully:', newUser.email);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: newUser.toSafeObject(),
    });
  } catch (error) {
    console.error('RYDO: Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create account. Please try again later.',
    });
  }
});

/* =====================================================
   LOGIN USER
   POST /api/auth/login
===================================================== */

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter both your email address and password.',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    console.log('RYDO: User logged in:', user.email);

    return res.json({
      success: true,
      message: 'Login successful!',
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error('RYDO: Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to login. Please try again later.',
    });
  }
});

/* =====================================================
   GET USER PROFILE
   GET /api/auth/profile/:userId
===================================================== */

router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    return res.json({
      success: true,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error('RYDO: Profile fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile.',
    });
  }
});

/* =====================================================
   EXPORT
===================================================== */

module.exports = router;
