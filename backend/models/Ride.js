const mongoose = require('mongoose');

/* =====================================================
   LOCATION SCHEMA
===================================================== */

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   LIVE LOCATION SCHEMA
===================================================== */

const liveLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   CAPTAIN LOCATION SCHEMA
===================================================== */

const captainLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   RIDER SCHEMA
===================================================== */

const riderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: null,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    /* -----------------------------------------------
       RIDER LIVE GPS LOCATION
    ----------------------------------------------- */

    location: {
      type: liveLocationSchema,
      default: null,
    },
  },
  {
    _id: true,
  }
);

/* =====================================================
   ROAD ROUTE SCHEMA
===================================================== */

const routeSchema = new mongoose.Schema(
  {
    /* -----------------------------------------------
       START LOCATION
    ----------------------------------------------- */

    start: {
      type: locationSchema,
      default: null,
    },

    /* -----------------------------------------------
       STOPS
    ----------------------------------------------- */

    stops: {
      type: [locationSchema],
      default: [],
    },

    /* -----------------------------------------------
       DESTINATION
    ----------------------------------------------- */

    destination: {
      type: locationSchema,
      default: null,
    },

    /* -----------------------------------------------
       ACTUAL ROAD ROUTE COORDINATES

       These coordinates come from OSRM.

       Each point:
       {
         latitude,
         longitude
       }
    ----------------------------------------------- */

    coordinates: {
      type: [
        new mongoose.Schema(
          {
            latitude: {
              type: Number,
              required: true,
            },

            longitude: {
              type: Number,
              required: true,
            },
          },
          {
            _id: false,
          }
        ),
      ],

      default: [],
    },

    /* -----------------------------------------------
       ROUTE DISTANCE
    ----------------------------------------------- */

    distanceMeters: {
      type: Number,
      default: 0,
    },

    distanceKm: {
      type: Number,
      default: 0,
    },

    /* -----------------------------------------------
       ROUTE DURATION
    ----------------------------------------------- */

    durationSeconds: {
      type: Number,
      default: 0,
    },

    durationMinutes: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   SOS EVENT SCHEMA
===================================================== */

const sosEventSchema = new mongoose.Schema(
  {
    riderName: {
      type: String,
      default: 'Unknown User',
      trim: true,
    },

    name: {
      type: String,
      default: 'Unknown User',
      trim: true,
    },

    role: {
      type: String,
      enum: ['captain', 'rider'],
      default: 'rider',
    },

    riderId: {
      type: String,
      default: null,
    },

    userId: {
      type: String,
      default: null,
    },

    bikeNumber: {
      type: String,
      default: null,
    },

    bloodGroup: {
      type: String,
      default: null,
    },

    emergencyContact: {
      name: {
        type: String,
        default: null,
      },
      phoneNumber: {
        type: String,
        default: null,
      },
    },

    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    triggeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

/* =====================================================
   RIDE SCHEMA
===================================================== */

const rideSchema = new mongoose.Schema(
  {
    /* =================================================
       RIDE INFORMATION
    ================================================= */

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

    captainId: {
      type: String,

      default: null,

      trim: true,
    },

    captainUserId: {
      type: String,

      default: null,

      trim: true,
    },

    /* =================================================
       RIDE STATUS
    ================================================= */

    status: {
      type: String,

      enum: [
        'ready',
        'live',
        'ended',
      ],

      default: 'ready',
    },

    isStarted: {
      type: Boolean,

      default: false,
    },

    /* =================================================
       RIDERS
    ================================================= */

    riders: {
      type: [riderSchema],

      default: [],
    },

    /* =================================================
       CAPTAIN LIVE LOCATION
    ================================================= */

    captainLocation: {
      type: captainLocationSchema,

      default: null,
    },

    /* =================================================
       ROUTE
    ================================================= */

    route: {
      type: routeSchema,

      default: () => ({
        start: null,

        stops: [],

        destination: null,

        coordinates: [],

        distanceMeters: 0,

        distanceKm: 0,

        durationSeconds: 0,

        durationMinutes: 0,
      }),
    },

    /* =================================================
       SOS EVENTS
    ================================================= */

    sosEvents: {
      type: [sosEventSchema],

      default: [],
    },
  },

  {
    timestamps: true,
  }
);

/* =====================================================
   MODEL
===================================================== */

module.exports =
  mongoose.model(
    'Ride',
    rideSchema
  );