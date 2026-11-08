# RYDO — Database Schema & MongoDB Architecture

This document outlines the Mongoose schemas, document models, fields, types, and indexes utilized across the RYDO platform.

---

## 1. Collections Overview

The RYDO MongoDB database consists of 3 primary collections:
1. `users` — User profiles, authentication credentials, bike info, and emergency contacts.
2. `rides` — Convoy rides, waypoints, routes, live locations, members, and SOS records.
3. `ridemessages` — In-ride communication logs, quick messages, and system alerts.

---

## 2. `users` Collection

### Schema Definition
```javascript
const userSchema = new mongoose.Schema(
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
    emergencyContact: {
      name: { type: String, required: true, trim: true },
      phoneNumber: { type: String, required: true, trim: true },
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
    passwordHash: {
      type: String,
      required: true,
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    profilePhoto: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);
```

### Indexes
* `email: 1` (Unique)
* `phoneNumber: 1`
* `name: 1`

---

## 3. `rides` Collection

### Schema Definition
```javascript
const rideSchema = new mongoose.Schema(
  {
    rideCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    rideName: {
      type: String,
      required: true,
      trim: true,
    },
    captainName: {
      type: String,
      required: true,
      trim: true,
    },
    captainUserId: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ready', 'live', 'ended'],
      default: 'ready',
    },
    isStarted: {
      type: Boolean,
      default: false,
    },
    riders: [
      {
        userId: { type: String, default: null, trim: true },
        name: { type: String, required: true, trim: true },
        joinedAt: { type: Date, default: Date.now },
        location: {
          latitude: { type: Number, default: null },
          longitude: { type: Number, default: null },
          updatedAt: { type: Date, default: null },
        },
      },
    ],
    captainLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    route: {
      start: {
        name: String,
        latitude: Number,
        longitude: Number,
      },
      destination: {
        name: String,
        latitude: Number,
        longitude: Number,
      },
      stops: [
        {
          name: String,
          latitude: Number,
          longitude: Number,
        },
      ],
      coordinates: [
        {
          latitude: Number,
          longitude: Number,
        },
      ],
      distanceKm: { type: Number, default: 0 },
      durationMinutes: { type: Number, default: 0 },
    },
    sosEvents: [
      {
        name: { type: String, required: true },
        role: { type: String, default: 'rider' },
        userId: { type: String, default: null },
        bikeNumber: { type: String, default: null },
        bloodGroup: { type: String, default: null },
        emergencyContact: {
          name: { type: String, default: null },
          phoneNumber: { type: String, default: null },
        },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        status: { type: String, enum: ['active', 'resolved'], default: 'active' },
        triggeredAt: { type: Date, default: Date.now },
        resolvedAt: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);
```

### Indexes
* `rideCode: 1` (Unique)
* `'riders.userId': 1`
* `captainUserId: 1`
* `status: 1`

---

## 4. `ridemessages` Collection

### Schema Definition
```javascript
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
  { timestamps: true }
);
```

### Indexes
* `messageId: 1` (Unique)
* `{ rideCode: 1, createdAt: 1 }` (Compound index for fast chronological message loading)

