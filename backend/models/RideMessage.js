const mongoose = require('mongoose');

/* =====================================================
   RIDE MESSAGE SCHEMA
   Stores all in-ride communication messages for persistence
===================================================== */

const rideMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    rideCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    senderId: {
      type: String,
      default: null,
      trim: true,
    },

    senderName: {
      type: String,
      required: true,
      trim: true,
    },

    senderRole: {
      type: String,
      enum: ['captain', 'rider', 'system'],
      default: 'rider',
    },

    messageText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    messageType: {
      type: String,
      enum: ['quick', 'custom', 'system'],
      default: 'quick',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient chronological ride message retrieval
rideMessageSchema.index({ rideCode: 1, createdAt: 1 });

module.exports = mongoose.model('RideMessage', rideMessageSchema);
