const mongoose = require('mongoose');

/* =====================================================
   EMERGENCY CONTACT SCHEMA
===================================================== */

const emergencyContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   USER SCHEMA
===================================================== */

const userSchema = new mongoose.Schema(
  {
    /* -------------------------------------------------
       BASIC PROFILE
    ------------------------------------------------- */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    bikeNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    bloodGroup: {
      type: String,
      required: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      uppercase: true,
      trim: true,
    },

    nativePlace: {
      type: String,
      required: true,
      trim: true,
    },

    /* -------------------------------------------------
       SAFETY & EMERGENCY
    ------------------------------------------------- */

    emergencyContact: {
      type: emergencyContactSchema,
      required: true,
    },

    emergencyContactConsent: {
      type: Boolean,
      required: true,
      default: false,
    },

    emergencyContactConsentAt: {
      type: Date,
      default: null,
    },

    /* -------------------------------------------------
       AUTHENTICATION
    ------------------------------------------------- */

    passwordHash: {
      type: String,
      required: true,
    },

    passwordSalt: {
      type: String,
      required: true,
    },

    /* -------------------------------------------------
       OPTIONAL PROFILE PHOTO
    ------------------------------------------------- */

    profilePhoto: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   SANITIZE USER FOR CLIENT
===================================================== */

userSchema.methods.toSafeObject = function (options = {}) {
  const user = this.toObject();

  delete user.passwordHash;
  delete user.passwordSalt;

  if (options.maskEmergencyPhone && user.emergencyContact?.phoneNumber) {
    const raw = user.emergencyContact.phoneNumber;
    if (raw.length >= 4) {
      user.emergencyContact.phoneNumber =
        raw.slice(0, 3) + '*****' + raw.slice(-2);
    }
  }

  return user;
};

/* =====================================================
   EXPORT
===================================================== */

module.exports = mongoose.model('User', userSchema);
