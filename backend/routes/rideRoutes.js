const express = require('express');
const Ride = require('../models/Ride');
const User = require('../models/User');

const router = express.Router();

/* =====================================================
   GENERATE RIDE CODE
===================================================== */

function generateRideCode() {
  const characters =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code = '';

  for (let i = 0; i < 6; i++) {
    code += characters.charAt(
      Math.floor(
        Math.random() * characters.length
      )
    );
  }

  return code;
}

/* =====================================================
   OPENSTREETMAP GEOCODING
===================================================== */

async function geocodeLocation(locationName) {
  const query =
    String(locationName).trim();

  if (!query) {
    throw new Error(
      'Location name is empty'
    );
  }

  const url =
    'https://nominatim.openstreetmap.org/search' +
    '?format=json' +
    '&limit=1' +
    '&q=' +
    encodeURIComponent(query);

  console.log(
    'RYDO: Geocoding:',
    query
  );

  const response =
    await fetch(url, {
      headers: {
        'User-Agent':
          'RYDO-Mobile-App/1.0',

        'Accept':
          'application/json',
      },
    });

  if (!response.ok) {
    throw new Error(
      `OpenStreetMap geocoding failed: ${response.status}`
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      `Location not found: ${query}`
    );
  }

  const result =
    data[0];

  const latitude =
    Number(result.lat);

  const longitude =
    Number(result.lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      `Invalid coordinates returned for: ${query}`
    );
  }

  return {
    name: query,

    latitude,

    longitude,
  };
}

/* =====================================================
   OSRM ROAD ROUTING
===================================================== */

async function getRoadRoute(locations) {
  if (
    !Array.isArray(locations) ||
    locations.length < 2
  ) {
    throw new Error(
      'At least two locations are required for routing'
    );
  }

  const coordinates =
    locations
      .map(
        (location) =>
          `${location.longitude},${location.latitude}`
      )
      .join(';');

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    '?overview=full' +
    '&geometries=geojson' +
    '&steps=true';

  console.log(
    '================================'
  );

  console.log(
    'RYDO: REQUESTING ROAD ROUTE'
  );

  console.log(
    'OSRM URL:',
    url
  );

  console.log(
    '================================'
  );

  const response =
    await fetch(url, {
      headers: {
        'User-Agent':
          'RYDO-Mobile-App/1.0',

        'Accept':
          'application/json',
      },
    });

  if (!response.ok) {
    throw new Error(
      `OSRM routing failed: ${response.status}`
    );
  }

  const data =
    await response.json();

  if (
    data.code !== 'Ok' ||
    !data.routes ||
    data.routes.length === 0
  ) {
    throw new Error(
      'OSRM could not find a road route'
    );
  }

  const route =
    data.routes[0];

  const coordinatesForAndroid =
    route.geometry.coordinates.map(
      (coordinate) => ({
        latitude:
          Number(coordinate[1]),

        longitude:
          Number(coordinate[0]),
      })
    );

  return {
    distanceMeters:
      route.distance,

    durationSeconds:
      route.duration,

    distanceKm:
      Number(
        (
          route.distance / 1000
        ).toFixed(2)
      ),

    durationMinutes:
      Number(
        (
          route.duration / 60
        ).toFixed(1)
      ),

    coordinates:
      coordinatesForAndroid,
  };
}

/* =====================================================
   CREATE RIDE
   POST /api/rides
===================================================== */

router.post(
  '/',
  async (req, res) => {
    try {
      const {
        rideName,
        captainName,
      } = req.body;

      if (
        !rideName ||
        !captainName
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Ride name and captain name are required',
        });
      }

      const cleanRideName =
        String(
          rideName
        ).trim();

      const cleanCaptainName =
        String(
          captainName
        ).trim();

      if (
        !cleanRideName ||
        !cleanCaptainName
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Ride name and captain name cannot be empty',
        });
      }

      let rideCode;

      let existingRide;

      do {
        rideCode =
          generateRideCode();

        existingRide =
          await Ride.findOne({
            rideCode,
          });
      } while (
        existingRide
      );

      const ride =
        await Ride.create({
          rideCode,

          rideName:
            cleanRideName,

          captainName:
            cleanCaptainName,

          status:
            'ready',

          isStarted:
            false,

          riders: [],

          captainLocation:
            null,

          route: {
            start:
              null,

            stops:
              [],

            destination:
              null,

            coordinates:
              [],

            distanceMeters:
              0,

            durationSeconds:
              0,

            distanceKm:
              0,

            durationMinutes:
              0,
          },
        });

      console.log(
        '================================'
      );

      console.log(
        'RYDO: RIDE CREATED'
      );

      console.log(
        'Ride Code:',
        ride.rideCode
      );

      console.log(
        'Ride Name:',
        ride.rideName
      );

      console.log(
        'Captain:',
        ride.captainName
      );

      console.log(
        '================================'
      );

      return res.status(201).json({
        success: true,

        message:
          'Ride created successfully',

        ride: {
          id:
            ride._id,

          rideCode:
            ride.rideCode,

          rideName:
            ride.rideName,

          captainName:
            ride.captainName,

          riders:
            ride.riders,

          isStarted:
            ride.isStarted,

          status:
            ride.status,

          captainLocation:
            ride.captainLocation,

          route:
            ride.route,
        },
      });

    } catch (error) {
      console.error(
        'RYDO: Create ride error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to create ride',
      });
    }
  }
);

/* =====================================================
   JOIN RIDE
   POST /api/rides/join
===================================================== */

router.post(
  '/join',
  async (req, res) => {
    try {
      const {
        rideCode,
        riderName,
        userId,
      } = req.body;

      if (
        !rideCode ||
        !riderName
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Ride code and rider name are required',
        });
      }

      const code =
        String(
          rideCode
        )
          .toUpperCase()
          .trim();

      const name =
        String(
          riderName
        ).trim();

      const riderUserId = userId ? String(userId).trim() : null;

      if (!name) {
        return res.status(400).json({
          success: false,

          message:
            'Rider name cannot be empty',
        });
      }

      const ride =
        await Ride.findOne({
          rideCode:
            code,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found. Check the ride code.',
        });
      }

      const existingRider =
        ride.riders.find(
          (rider) =>
            (riderUserId && rider.userId && String(rider.userId) === riderUserId) ||
            rider.name.toLowerCase() === name.toLowerCase()
        );

      if (existingRider) {
        if (riderUserId && !existingRider.userId) {
          existingRider.userId = riderUserId;
        }
        existingRider.name = name;
        await ride.save();
      } else {
        ride.riders.push({
          userId: riderUserId || new mongoose.Types.ObjectId().toString(),
          name,
          joinedAt: new Date(),
          location: null,
        });

        await ride.save();
      }

      console.log(
        `RYDO: ${name} (userId: ${riderUserId}) joined ride ${ride.rideCode}`
      );

      return res.json({
        success: true,

        message:
          'Joined ride successfully',

        ride: {
          id:
            ride._id,

          rideCode:
            ride.rideCode,

          rideName:
            ride.rideName,

          captainName:
            ride.captainName,

          riders:
            ride.riders,

          isStarted:
            ride.isStarted,

          status:
            ride.status,

          captainLocation:
            ride.captainLocation,

          route:
            ride.route,
        },
      });

    } catch (error) {
      console.error(
        'RYDO: Join ride error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to join ride',
      });
    }
  }
);

/* =====================================================
   GET RIDE
   GET /api/rides/:rideCode
===================================================== */

router.get(
  '/:rideCode',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const ride =
        await Ride.findOne({
          rideCode,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      return res.json({
        success: true,

        ride,
      });

    } catch (error) {
      console.error(
        'RYDO: Get ride error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to get ride',
      });
    }
  }
);

/* =====================================================
   START / END RIDE
   PATCH /api/rides/:rideCode/status
===================================================== */

router.patch(
  '/:rideCode/status',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const {
        isStarted,
      } = req.body;

      const started =
        Boolean(
          isStarted
        );

      const status =
        started
          ? 'live'
          : 'ended';

      const ride =
        await Ride.findOneAndUpdate(
          {
            rideCode,
          },

          {
            $set: {
              isStarted:
                started,

              status,
            },
          },

          {
            new: true,
          }
        );

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      return res.json({
        success: true,

        message:
          ride.isStarted
            ? 'Ride started'
            : 'Ride ended',

        ride,
      });

    } catch (error) {
      console.error(
        'RYDO: Ride status error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to update ride status',
      });
    }
  }
);

/* =====================================================
   UPDATE ROUTE
   PATCH /api/rides/:rideCode/route
===================================================== */

router.patch(
  '/:rideCode/route',
  async (req, res) => {
    try {
      console.log(
        '================================'
      );

      console.log(
        'RYDO: ROUTE UPDATE REQUEST'
      );

      console.log(
        'Ride Code:',
        req.params.rideCode
      );

      console.log(
        'Request Body:',
        req.body
      );

      console.log(
        '================================'
      );

      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const {
        start,
        destination,
        stops,
      } = req.body;

      if (
        !start ||
        !String(start).trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Start location is required',
        });
      }

      if (
        !destination ||
        !String(destination).trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Destination is required',
        });
      }

      const ride =
        await Ride.findOne({
          rideCode,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      const cleanStops =
        Array.isArray(stops)
          ? stops
              .map(
                (stop) =>
                  String(
                    stop
                  ).trim()
              )
              .filter(
                (stop) =>
                  stop.length > 0
              )
          : [];

      console.log(
        'RYDO: Geocoding start...'
      );

      const startLocation =
        await geocodeLocation(
          start
        );

      const stopLocations =
        [];

      for (
        let i = 0;
        i <
        cleanStops.length;
        i++
      ) {
        console.log(
          `RYDO: Geocoding stop ${i + 1}:`,
          cleanStops[i]
        );

        const stopLocation =
          await geocodeLocation(
            cleanStops[i]
          );

        stopLocations.push(
          stopLocation
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              1000
            )
        );
      }

      console.log(
        'RYDO: Geocoding destination...'
      );

      const destinationLocation =
        await geocodeLocation(
          destination
        );

      const allLocations =
        [
          startLocation,

          ...stopLocations,

          destinationLocation,
        ];

      console.log(
        '================================'
      );

      console.log(
        'RYDO: LOCATIONS FOR ROUTING'
      );

      allLocations.forEach(
        (
          location,
          index
        ) => {
          console.log(
            `${index + 1}. ${location.name}`
          );

          console.log(
            '   Latitude:',
            location.latitude
          );

          console.log(
            '   Longitude:',
            location.longitude
          );
        }
      );

      console.log(
        '================================'
      );

      console.log(
        'RYDO: Getting actual road route...'
      );

      const roadRoute =
        await getRoadRoute(
          allLocations
        );

      console.log(
        '================================'
      );

      console.log(
        'RYDO: ROAD ROUTE RECEIVED'
      );

      console.log(
        'Distance:',
        roadRoute.distanceKm,
        'km'
      );

      console.log(
        'Duration:',
        roadRoute.durationMinutes,
        'minutes'
      );

      console.log(
        'Route points:',
        roadRoute.coordinates.length
      );

      console.log(
        '================================'
      );

      ride.route = {
        start:
          startLocation,

        stops:
          stopLocations,

        destination:
          destinationLocation,

        coordinates:
          roadRoute.coordinates,

        distanceMeters:
          roadRoute.distanceMeters,

        durationSeconds:
          roadRoute.durationSeconds,

        distanceKm:
          roadRoute.distanceKm,

        durationMinutes:
          roadRoute.durationMinutes,
      };

      await ride.save();

      console.log(
        '================================'
      );

      console.log(
        'RYDO: ROUTE SAVED SUCCESSFULLY'
      );

      console.log(
        'Ride Code:',
        ride.rideCode
      );

      console.log(
        'Route Points:',
        ride.route.coordinates.length
      );

      console.log(
        '================================'
      );

      return res.json({
        success: true,

        message:
          'Road route generated successfully',

        ride,
      });

    } catch (error) {
      console.error(
        'RYDO: Route update error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          'Failed to generate road route',
      });
    }
  }
);

/* =====================================================
   REMOVE RIDER
   DELETE /api/rides/:rideCode/riders/:riderId
===================================================== */

router.delete(
  '/:rideCode/riders/:riderId',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const riderId =
        req.params.riderId;

      const ride =
        await Ride.findOne({
          rideCode,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      const rider =
        ride.riders.id(
          riderId
        );

      if (!rider) {
        return res.status(404).json({
          success: false,

          message:
            'Rider not found',
        });
      }

      const riderName =
        rider.name;

      rider.deleteOne();

      await ride.save();

      console.log(
        `RYDO: Rider ${riderName} removed from ${ride.rideCode}`
      );

      return res.json({
        success: true,

        message:
          'Rider removed successfully',

        ride,
      });

    } catch (error) {
      console.error(
        'RYDO: Remove rider error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to remove rider',
      });
    }
  }
);

/* =====================================================
   LEAVE RIDE
   POST /api/rides/:rideCode/leave
===================================================== */

router.post(
  '/:rideCode/leave',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const {
        riderName,
      } = req.body;

      if (!riderName) {
        return res.status(400).json({
          success: false,

          message:
            'Rider name is required',
        });
      }

      const name =
        String(
          riderName
        ).trim();

      const ride =
        await Ride.findOne({
          rideCode,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      const originalLength =
        ride.riders.length;

      ride.riders =
        ride.riders.filter(
          (rider) =>
            rider.name
              .toLowerCase() !==
            name.toLowerCase()
        );

      if (
        ride.riders.length ===
        originalLength
      ) {
        return res.status(404).json({
          success: false,

          message:
            'Rider is not a member of this ride',
        });
      }

      await ride.save();

      console.log(
        `RYDO: ${name} left ride ${ride.rideCode}`
      );

      return res.json({
        success: true,

        message:
          'Left ride successfully',

        ride,
      });

    } catch (error) {
      console.error(
        'RYDO: Leave ride error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to leave ride',
      });
    }
  }
);

/* =====================================================
   UPDATE CAPTAIN LOCATION
   PATCH /api/rides/:rideCode/captain-location
===================================================== */

router.patch(
  '/:rideCode/captain-location',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const {
        latitude,
        longitude,
      } = req.body;

      const lat =
        Number(
          latitude
        );

      const lng =
        Number(
          longitude
        );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Valid latitude and longitude are required',
        });
      }

      const ride =
        await Ride.findOneAndUpdate(
          {
            rideCode,
          },

          {
            $set: {
              captainLocation: {
                latitude:
                  lat,

                longitude:
                  lng,

                updatedAt:
                  new Date(),
              },
            },
          },

          {
            new: true,
          }
        );

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      const io = req.app.get('io');
      if (io) {
        io.to(rideCode).emit('locationUpdated', {
          memberId: 'captain-' + String(ride.captainName || 'captain').toLowerCase().replace(/\s+/g, '-'),
          rideCode,
          userName: ride.captainName,
          role: 'captain',
          latitude: lat,
          longitude: lng,
          updatedAt: ride.captainLocation?.updatedAt || new Date().toISOString(),
        });
      }

      return res.json({
        success: true,

        message:
          'Captain location updated',

        captainLocation:
          ride.captainLocation,
      });

    } catch (error) {
      console.error(
        'RYDO: Captain location error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to update captain location',
      });
    }
  }
);

/* =====================================================
   UPDATE RIDER LIVE LOCATION
   PATCH /api/rides/:rideCode/riders/:riderId/location

   This stores the current GPS position of a rider.
===================================================== */

router.patch(
  '/:rideCode/riders/:riderId/location',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const riderId =
        req.params.riderId;

      const {
        latitude,
        longitude,
      } = req.body;

      const lat =
        Number(
          latitude
        );

      const lng =
        Number(
          longitude
        );

      /* -----------------------------------------------
         VALIDATE GPS
      ----------------------------------------------- */

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Valid latitude and longitude are required',
        });
      }

      if (
        lat < -90 ||
        lat > 90
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Invalid latitude',
        });
      }

      if (
        lng < -180 ||
        lng > 180
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Invalid longitude',
        });
      }

      /* -----------------------------------------------
         FIND RIDE
      ----------------------------------------------- */

      const ride =
        await Ride.findOne({
          rideCode,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      /* -----------------------------------------------
         FIND RIDER & UPDATE LOCATION
      ----------------------------------------------- */

      const isObjectId = riderId && riderId.match(/^[0-9a-fA-F]{24}$/);
      let rider = isObjectId ? ride.riders.id(riderId) : null;

      if (!rider) {
        rider = ride.riders.find(
          (r) => r.name.toLowerCase() === String(riderId).trim().toLowerCase()
        );
      }

      const updatedAt = new Date();

      if (!rider) {
        // Auto-add rider if not present
        const newRider = {
          name: String(riderId).trim(),
          joinedAt: new Date(),
          location: {
            latitude: lat,
            longitude: lng,
            updatedAt,
          },
        };
        ride.riders.push(newRider);
        rider = ride.riders[ride.riders.length - 1];
      } else {
        rider.location = {
          latitude: lat,
          longitude: lng,
          updatedAt,
        };
      }

      await ride.save();

      console.log('================================');
      console.log('RYDO: RIDER LOCATION UPDATED');
      console.log('Ride Code:', rideCode);
      console.log('Rider:', rider.name);
      console.log('Latitude:', lat);
      console.log('Longitude:', lng);
      console.log('================================');

      console.log('RYDO LOCATION SAVED:', {
        rideCode,
        userId: rider._id.toString(),
        role: 'rider',
      });

      const io = req.app.get('io');
      if (io) {
        io.to(rideCode).emit('locationUpdated', {
          memberId: rider._id.toString(),
          rideCode,
          userName: rider.name,
          role: 'rider',
          latitude: lat,
          longitude: lng,
          updatedAt: rider.location?.updatedAt ? rider.location.updatedAt.toISOString() : new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        message: 'Rider location updated',
        rider: {
          id: rider._id,
          userId: rider._id,
          name: rider.name,
          role: 'rider',
          location: rider.location,
        },
      });

    } catch (error) {
      console.error('RYDO: Rider location error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update rider location',
      });
    }
  }
);

/* =====================================================
   UPDATE RIDER LOCATION BY NAME / USERID
   PATCH /api/rides/:rideCode/rider-location
===================================================== */

router.patch(
  '/:rideCode/rider-location',
  async (req, res) => {
    try {
      const rideCode = String(req.params.rideCode).toUpperCase().trim();
      const { riderName, userId, latitude, longitude } = req.body;

      const lat = Number(latitude);
      const lng = Number(longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({
          success: false,
          message: 'Valid latitude and longitude are required',
        });
      }

      if (!riderName && !userId) {
        return res.status(400).json({
          success: false,
          message: 'Rider name or userId is required',
        });
      }

      const name = String(riderName || '').trim();
      const rUserId = userId ? String(userId).trim() : null;
      const isObjectId = rUserId && rUserId.match(/^[0-9a-fA-F]{24}$/);
      const updatedAt = new Date();

      const rideDoc = await Ride.findOne({ rideCode });
      if (!rideDoc) {
        return res.status(404).json({
          success: false,
          message: 'Ride not found',
        });
      }

      let rider = (rideDoc.riders || []).find(
        (r) =>
          (rUserId && r.userId && String(r.userId) === String(rUserId)) ||
          (isObjectId && r._id && r._id.toString() === String(rUserId)) ||
          (name && r.name && r.name.toLowerCase() === name.toLowerCase())
      );

      if (!rider) {
        rideDoc.riders.push({
          userId: rUserId,
          name: name || 'Rider',
          joinedAt: new Date(),
          location: {
            latitude: lat,
            longitude: lng,
            updatedAt,
          },
        });
      } else {
        rider.location = {
          latitude: lat,
          longitude: lng,
          updatedAt,
        };
        if (rUserId && !rider.userId) {
          rider.userId = rUserId;
        }
      }

      await rideDoc.save();

      const finalUserId = rUserId || name;

      console.log('RYDO LOCATION UPDATE:', {
        userId: finalUserId,
        role: 'rider',
        rideCode,
        latitude: lat,
        longitude: lng,
      });

      console.log('RYDO LOCATION SAVED:', {
        userId: finalUserId,
        role: 'rider',
        rideCode,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(rideCode).emit('locationUpdated', {
          userId: finalUserId,
          memberId: finalUserId,
          rideCode,
          userName: name || 'Rider',
          role: 'rider',
          latitude: lat,
          longitude: lng,
          updatedAt: updatedAt.toISOString(),
        });
      }

      return res.json({
        success: true,
        message: 'Rider location updated',
        location: {
          latitude: lat,
          longitude: lng,
          updatedAt,
        },
      });
    } catch (error) {
      console.error('RYDO: Rider location error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update rider location',
      });
    }
  }
);

/* =====================================================
   GET ALL LIVE LOCATIONS
   GET /api/rides/:rideCode/locations

   Returns:
   - Captain location
   - Every rider location (with location: null if no location yet)
===================================================== */

router.get(
  '/:rideCode/locations',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const ride =
        await Ride.findOne({
          rideCode,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,
          message: 'Ride not found',
        });
      }

      const riders = (ride.riders || []).map((rider) => {
        const hasLoc =
          rider.location &&
          Number.isFinite(Number(rider.location.latitude)) &&
          Number.isFinite(Number(rider.location.longitude));

        const rUserId = rider.userId || rider._id.toString();

        return {
          userId: rUserId,
          id: rUserId,
          _id: rider._id.toString(),
          name: rider.name,
          role: 'rider',
          location: hasLoc
            ? {
                latitude: Number(rider.location.latitude),
                longitude: Number(rider.location.longitude),
                updatedAt: rider.location.updatedAt,
              }
            : null,
        };
      });

      const hasCaptainLocation =
        ride.captainLocation &&
        Number.isFinite(Number(ride.captainLocation.latitude)) &&
        Number.isFinite(Number(ride.captainLocation.longitude));

      const captain = {
        userId: ride.captainId || ride.captainUserId || 'captain',
        name: ride.captainName,
        role: 'captain',
        location: hasCaptainLocation
          ? {
              latitude: Number(ride.captainLocation.latitude),
              longitude: Number(ride.captainLocation.longitude),
              updatedAt: ride.captainLocation.updatedAt,
            }
          : null,
      };

      const validRidersWithLocation = riders.filter((r) => r.location !== null).length;
      const totalLocations =
        (hasCaptainLocation ? 1 : 0) + validRidersWithLocation;

      // Required log per spec
      console.log('RYDO LIVE LOCATIONS:');
      console.log(
        JSON.stringify(
          {
            captain,
            rideCode: ride.rideCode,
            riders,
            success: true,
            totalLocations: totalLocations > 0 ? totalLocations : (riders.length + (hasCaptainLocation ? 1 : 0)),
          },
          null,
          2
        )
      );

      return res.json({
        success: true,
        rideCode: ride.rideCode,
        captain,
        captainLocation: captain.location,
        riders,
        totalLocations: totalLocations > 0 ? totalLocations : (riders.length + (hasCaptainLocation ? 1 : 0)),
      });

    } catch (error) {
      console.error('RYDO: Get live locations error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get live locations',
      });
    }
  }
);

/* =====================================================
   SOS ALERT

   POST /api/rides/:rideCode/sos

   Body:
   {
     riderName: 'Alice',
     riderId: 'mongodb-rider-id',   (optional)
     latitude: 17.3850,
     longitude: 78.4867
   }
===================================================== */

router.post(
  '/:rideCode/sos',
  async (req, res) => {
    try {
      const rideCode =
        String(
          req.params.rideCode
        )
          .toUpperCase()
          .trim();

      const {
        riderName,
        riderId,
        userId,
        latitude,
        longitude,
      } = req.body;

      /* -------------------------------------------
         VALIDATE
      ------------------------------------------- */

      if (!riderName) {
        return res.status(400).json({
          success: false,

          message:
            'Rider name is required for SOS',
        });
      }

      const lat =
        Number(latitude);

      const lng =
        Number(longitude);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Valid latitude and longitude are required for SOS',
        });
      }

      /* -------------------------------------------
         FIND RIDE
      ------------------------------------------- */

      const ride =
        await Ride.findOne({
          rideCode,
        });

      if (!ride) {
        return res.status(404).json({
          success: false,

          message:
            'Ride not found',
        });
      }

      /* -------------------------------------------
         SECURELY RETRIEVE USER PROFILE (FROM DB)
      ------------------------------------------- */

      let userProfile = null;

      if (userId && userId.match(/^[0-9a-fA-F]{24}$/)) {
        userProfile = await User.findById(userId);
      }

      if (!userProfile && riderName) {
        userProfile = await User.findOne({
          name: new RegExp(`^${riderName.trim()}$`, 'i'),
        });
      }

      const bikeNumber = userProfile?.bikeNumber || null;
      const bloodGroup = userProfile?.bloodGroup || null;
      const emergencyContact = userProfile?.emergencyContact
        ? {
            name: userProfile.emergencyContact.name,
            phoneNumber: userProfile.emergencyContact.phoneNumber,
          }
        : { name: null, phoneNumber: null };

      /* -------------------------------------------
         SAVE SOS EVENT
      ------------------------------------------- */

      const sosEvent = {
        riderName:
          String(riderName).trim(),

        riderId:
          riderId || null,

        userId:
          userProfile ? String(userProfile._id) : (userId || null),

        bikeNumber,

        bloodGroup,

        emergencyContact,

        status:
          'active',

        latitude: lat,

        longitude: lng,

        triggeredAt:
          new Date(),
      };

      ride.sosEvents.push(sosEvent);

      await ride.save();

      /* -------------------------------------------
         BROADCAST VIA SOCKET
      ------------------------------------------- */

      const savedEvent =
        ride.sosEvents[
          ride.sosEvents.length - 1
        ];

      const io =
        req.app.get('io');

      if (io) {
        io
          .to(rideCode)
          .emit(
            'sosAlert',
            {
              rideCode,

              riderName:
                sosEvent.riderName,

              riderId:
                sosEvent.riderId,

              userId:
                sosEvent.userId,

              bikeNumber:
                sosEvent.bikeNumber,

              bloodGroup:
                sosEvent.bloodGroup,

              emergencyContact: {
                name: sosEvent.emergencyContact?.name || null,
                phoneNumber: sosEvent.emergencyContact?.phoneNumber || null,
              },

              latitude:
                sosEvent.latitude,

              longitude:
                sosEvent.longitude,

              triggeredAt:
                sosEvent.triggeredAt,

              status:
                sosEvent.status,

              sosId:
                savedEvent._id,
            }
          );

        console.log(
          'RYDO: SOS BROADCAST TO RIDE:',
          rideCode
        );
      }

      /* -------------------------------------------
         LOG
      ------------------------------------------- */

      console.log(
        '================================'
      );

      console.log(
        'RYDO: SOS RECEIVED & EMERGENCY ALERT DISPATCHED'
      );

      console.log(
        'Ride:',
        rideCode
      );

      console.log(
        'Rider:',
        sosEvent.riderName
      );

      if (bikeNumber) {
        console.log('Bike Number:', bikeNumber);
      }

      if (bloodGroup) {
        console.log('Blood Group:', bloodGroup);
      }

      if (emergencyContact?.name) {
        console.log('Emergency Contact:', emergencyContact.name, `(${emergencyContact.phoneNumber})`);
      }

      console.log(
        'Latitude:',
        sosEvent.latitude
      );

      console.log(
        'Longitude:',
        sosEvent.longitude
      );

      console.log(
        '================================'
      );

      return res.json({
        success: true,

        message:
          'SOS sent successfully. Emergency contact and crew alerted.',

        sos: {
          id:
            savedEvent._id,

          riderName:
            sosEvent.riderName,

          bikeNumber:
            sosEvent.bikeNumber,

          bloodGroup:
            sosEvent.bloodGroup,

          emergencyContact:
            sosEvent.emergencyContact,

          latitude:
            sosEvent.latitude,

          longitude:
            sosEvent.longitude,

          triggeredAt:
            sosEvent.triggeredAt,
        },
      });

    } catch (error) {
      console.error(
        'RYDO: SOS error'
      );

      console.error(error);

      return res.status(500).json({
        success: false,

        message:
          'Failed to send SOS',
      });
    }
  }
);


/* =====================================================
   EXPORT
===================================================== */

module.exports =
  router;