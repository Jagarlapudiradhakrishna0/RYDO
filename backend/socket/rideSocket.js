/* =====================================================
   RYDO - SOCKET.IO RIDE SERVER

   File:
   backend/socket/rideSocket.js

   PURPOSE:
   - Manage Socket.IO rooms per rideCode
   - Instant initial location snapshots upon joining (from DB + in-memory)
   - Real-time bidirectional location broadcasting (Captain <-> Riders)
   - Persistent MongoDB location updates so locations survive restarts
   ===================================================== */

const Ride = require('../models/Ride');

/* =====================================================
   IN-MEMORY ACTIVE RIDE STORE
===================================================== */

const rideRooms = new Map();

function getOrCreateRoom(rideCode) {
  const code = String(rideCode || '').toUpperCase().trim();
  if (!rideRooms.has(code)) {
    rideRooms.set(code, {
      captainLocation: null,
      riderLocations: new Map(),
    });
  }
  return rideRooms.get(code);
}

/* =====================================================
   INITIALIZE SOCKET.IO
===================================================== */

function initializeRideSocket(io) {
  console.log('================================');
  console.log('RYDO: Socket.IO INITIALIZING');
  console.log('================================');

  io.on('connection', (socket) => {
    console.log('RYDO: SOCKET CONNECTED:', socket.id);

    /* =================================================
       JOIN RIDE
       Event: joinRide
       Data: { rideCode, memberId, userName, role }
    ================================================= */
    socket.on('joinRide', async (data) => {
      try {
        if (!data) {
          console.log('RYDO: joinRide received empty data');
          return;
        }

        const rideCode = String(data.rideCode || '').toUpperCase().trim();
        const userName = String(data.userName || '').trim();
        const role = String(data.role || 'rider').toLowerCase().trim();
        const memberId = String(data.memberId || '').trim();

        if (!rideCode) {
          socket.emit('socketError', { message: 'Ride code is required' });
          return;
        }

        if (!userName) {
          socket.emit('socketError', { message: 'User name is required' });
          return;
        }

        const validRole = role === 'captain' ? 'captain' : 'rider';
        const finalMemberId =
          memberId ||
          `${validRole}-${userName.toLowerCase().replace(/\s+/g, '-')}`;

        // Leave previous room if switching
        if (socket.rideCode && socket.rideCode !== rideCode) {
          socket.leave(socket.rideCode);
          console.log('RYDO: Left previous ride room:', socket.rideCode);
        }

        // Join socket room
        socket.join(rideCode);

        // Save socket metadata
        socket.rideCode = rideCode;
        socket.memberId = finalMemberId;
        socket.userName = userName;
        socket.role = validRole;

        console.log('================================');
        console.log(`RYDO: ${userName} (${validRole}) JOINED RIDE ${rideCode}`);
        console.log('Socket ID:', socket.id);
        console.log('Member ID:', finalMemberId);
        console.log('================================');

        // Confirm to user
        socket.emit('rideJoined', {
          success: true,
          rideCode,
          memberId: finalMemberId,
          userName,
          role: validRole,
          message: 'Connected to ride successfully',
        });

        // POPULATE / MERGE FROM MONGODB
        const roomState = getOrCreateRoom(rideCode);
        try {
          const dbRide = await Ride.findOne({ rideCode });
          if (dbRide) {
            if (
              !roomState.captainLocation &&
              dbRide.captainLocation &&
              Number.isFinite(Number(dbRide.captainLocation.latitude)) &&
              Number.isFinite(Number(dbRide.captainLocation.longitude))
            ) {
              roomState.captainLocation = {
                memberId: `captain-${String(dbRide.captainName || 'captain')
                  .toLowerCase()
                  .replace(/\s+/g, '-')}`,
                userName: dbRide.captainName,
                role: 'captain',
                latitude: Number(dbRide.captainLocation.latitude),
                longitude: Number(dbRide.captainLocation.longitude),
                updatedAt: dbRide.captainLocation.updatedAt
                  ? new Date(dbRide.captainLocation.updatedAt).toISOString()
                  : new Date().toISOString(),
              };
            }

            if (Array.isArray(dbRide.riders)) {
              dbRide.riders.forEach((r) => {
                if (
                  r.location &&
                  Number.isFinite(Number(r.location.latitude)) &&
                  Number.isFinite(Number(r.location.longitude))
                ) {
                  const rMemberId = r._id
                    ? r._id.toString()
                    : `rider-${r.name.toLowerCase().replace(/\s+/g, '-')}`;

                  // Deduplicate by rider name
                  for (const [existingKey, existing] of roomState.riderLocations.entries()) {
                    if (existing.userName.toLowerCase() === r.name.toLowerCase()) {
                      roomState.riderLocations.delete(existingKey);
                    }
                  }

                  roomState.riderLocations.set(rMemberId, {
                    memberId: rMemberId,
                    userName: r.name,
                    role: 'rider',
                    latitude: Number(r.location.latitude),
                    longitude: Number(r.location.longitude),
                    updatedAt: r.location.updatedAt
                      ? new Date(r.location.updatedAt).toISOString()
                      : new Date().toISOString(),
                  });
                }
              });
            }
          }
        } catch (dbErr) {
          console.error('RYDO: DB snapshot hydration error:', dbErr);
        }

        const ridersSnapshot = Array.from(roomState.riderLocations.values());

        socket.emit('locationsSnapshot', {
          success: true,
          rideCode,
          captainLocation: roomState.captainLocation,
          riders: ridersSnapshot,
          timestamp: new Date().toISOString(),
        });

        // Notify other room members
        socket.to(rideCode).emit('userJoined', {
          memberId: finalMemberId,
          userName,
          role: validRole,
          rideCode,
        });
      } catch (error) {
        console.error('RYDO: joinRide error:', error);
        socket.emit('socketError', { message: 'Failed to join ride' });
      }
    });

    /* =================================================
       LIVE LOCATION UPDATE
       Event: updateLocation
       Data: { rideCode, memberId, userName, role, latitude, longitude, updatedAt }
    ================================================= */
    socket.on('updateLocation', async (data) => {
      try {
        if (!data) return;

        const rideCode = String(
          data.rideCode || socket.rideCode || ''
        ).toUpperCase().trim();

        const userName = String(
          data.userName || socket.userName || ''
        ).trim();

        const role = String(
          data.role || socket.role || 'rider'
        ).toLowerCase().trim();

        const userId = String(
          data.userId || data.memberId || socket.userId || socket.memberId || ''
        ).trim();

        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);

        if (!rideCode || !userName || !userId) {
          return;
        }

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return;
        }

        const validRole = role === 'captain' ? 'captain' : 'rider';
        const updatedAt = data.updatedAt || new Date().toISOString();

        const locationData = {
          socketId: socket.id,
          userId,
          memberId: userId,
          rideCode,
          userName,
          role: validRole,
          latitude,
          longitude,
          updatedAt,
        };

        // Update in-memory room state
        const roomState = getOrCreateRoom(rideCode);
        if (validRole === 'captain') {
          roomState.captainLocation = locationData;
        } else {
          // Deduplicate by userId or name
          for (const [existingKey, existing] of roomState.riderLocations.entries()) {
            if (
              existingKey === userId ||
              existing.userId === userId ||
              existing.userName.toLowerCase() === userName.toLowerCase()
            ) {
              roomState.riderLocations.delete(existingKey);
            }
          }
          roomState.riderLocations.set(userId, locationData);
        }

        // Required debug logs
        console.log('RYDO SOCKET LOCATION:', {
          userId,
          role: validRole,
          rideCode,
        });

        console.log('RYDO LOCATION UPDATE:', {
          userId,
          role: validRole,
          rideCode,
          latitude,
          longitude,
        });

        // Broadcast to EVERYONE in this ride room in real time
        io.to(rideCode).emit('locationUpdated', locationData);

        // PERSIST TO MONGODB SO LOCATIONS SURVIVE RESTARTS
        const updateDate = new Date(updatedAt);
        const rideDoc = await Ride.findOne({ rideCode });

        if (rideDoc) {
          if (validRole === 'captain') {
            rideDoc.captainLocation = {
              latitude,
              longitude,
              updatedAt: updateDate,
            };
            rideDoc.captainId = userId;
            rideDoc.captainUserId = userId;
            await rideDoc.save();

            console.log('RYDO LOCATION SAVED:', {
              userId,
              role: 'captain',
              rideCode,
            });
          } else {
            const isObjectId = userId && userId.match(/^[0-9a-fA-F]{24}$/);
            let rider = (rideDoc.riders || []).find(
              (r) =>
                (userId && r.userId && String(r.userId) === String(userId)) ||
                (isObjectId && r._id && r._id.toString() === String(userId)) ||
                (userName && r.name && r.name.toLowerCase() === userName.toLowerCase())
            );

            if (!rider) {
              rideDoc.riders.push({
                userId,
                name: userName.trim(),
                joinedAt: new Date(),
                location: {
                  latitude,
                  longitude,
                  updatedAt: updateDate,
                },
              });
            } else {
              rider.location = {
                latitude,
                longitude,
                updatedAt: updateDate,
              };
              if (userId && !rider.userId) {
                rider.userId = userId;
              }
            }

            await rideDoc.save();

            console.log('RYDO LOCATION SAVED:', {
              userId,
              role: 'rider',
              rideCode,
            });
          }
        }
      } catch (error) {
        console.error('RYDO: updateLocation error:', error);
      }
    });

    /* =================================================
       REQUEST SNAPSHOT EXPLICITLY (e.g. on foreground/reconnect)
       Event: requestLocationSnapshot
    ================================================= */
    socket.on('requestLocationSnapshot', async (data) => {
      try {
        const rideCode = String(
          data?.rideCode || socket.rideCode || ''
        ).toUpperCase().trim();

        if (!rideCode) return;

        const roomState = getOrCreateRoom(rideCode);
        try {
          const dbRide = await Ride.findOne({ rideCode });
          if (dbRide) {
            if (
              !roomState.captainLocation &&
              dbRide.captainLocation &&
              Number.isFinite(Number(dbRide.captainLocation.latitude))
            ) {
              roomState.captainLocation = {
                memberId: `captain-${String(dbRide.captainName || 'captain')
                  .toLowerCase()
                  .replace(/\s+/g, '-')}`,
                userName: dbRide.captainName,
                role: 'captain',
                latitude: Number(dbRide.captainLocation.latitude),
                longitude: Number(dbRide.captainLocation.longitude),
                updatedAt: dbRide.captainLocation.updatedAt
                  ? new Date(dbRide.captainLocation.updatedAt).toISOString()
                  : new Date().toISOString(),
              };
            }

            if (Array.isArray(dbRide.riders)) {
              dbRide.riders.forEach((r) => {
                if (
                  r.location &&
                  Number.isFinite(Number(r.location.latitude))
                ) {
                  const rMemberId = r._id
                    ? r._id.toString()
                    : `rider-${r.name.toLowerCase().replace(/\s+/g, '-')}`;

                  if (!roomState.riderLocations.has(rMemberId)) {
                    roomState.riderLocations.set(rMemberId, {
                      memberId: rMemberId,
                      userName: r.name,
                      role: 'rider',
                      latitude: Number(r.location.latitude),
                      longitude: Number(r.location.longitude),
                      updatedAt: r.location.updatedAt
                        ? new Date(r.location.updatedAt).toISOString()
                        : new Date().toISOString(),
                    });
                  }
                }
              });
            }
          }
        } catch (dbErr) {
          console.error('RYDO: DB snapshot hydration error:', dbErr);
        }

        const ridersSnapshot = Array.from(roomState.riderLocations.values());

        socket.emit('locationsSnapshot', {
          success: true,
          rideCode,
          captainLocation: roomState.captainLocation,
          riders: ridersSnapshot,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error('RYDO: requestLocationSnapshot error:', e);
      }
    });

    /* =================================================
       GET SOCKET INFO
    ================================================= */
    socket.on('getSocketInfo', () => {
      socket.emit('socketInfo', {
        socketId: socket.id,
        memberId: socket.memberId || null,
        rideCode: socket.rideCode || null,
        userName: socket.userName || null,
        role: socket.role || null,
      });
    });

    /* =================================================
       LEAVE RIDE
    ================================================= */
    socket.on('leaveRide', () => {
      try {
        const rideCode = socket.rideCode;
        const userName = socket.userName;
        const role = socket.role;
        const memberId = socket.memberId;

        if (!rideCode) return;

        console.log(`RYDO: ${userName} left ride ${rideCode}`);

        // Clear in-memory rider location
        const roomState = rooms.get(rideCode);
        if (roomState) {
          if (memberId) roomState.riderLocations.delete(memberId);
          for (const [key, val] of roomState.riderLocations.entries()) {
            if (val.userName?.toLowerCase() === userName?.toLowerCase() || val.userId === memberId) {
              roomState.riderLocations.delete(key);
            }
          }
        }

        // Clear persisted live location in MongoDB
        if (role === 'rider' && userName) {
          Ride.findOne({ rideCode }).then((rDoc) => {
            if (rDoc && Array.isArray(rDoc.riders)) {
              const r = rDoc.riders.find(
                (m) =>
                  (memberId && (m.userId === memberId || m._id?.toString() === memberId)) ||
                  m.name?.toLowerCase() === userName.toLowerCase()
              );
              if (r) {
                r.location = null;
                rDoc.save().catch(() => {});
              }
            }
          }).catch(() => {});
        }

        socket.to(rideCode).emit('userLeft', {
          socketId: socket.id,
          memberId,
          userId: memberId,
          rideCode,
          userName,
          role,
        });

        socket.leave(rideCode);
        socket.rideCode = null;
        socket.memberId = null;
        socket.userId = null;
        socket.userName = null;
        socket.role = null;
      } catch (error) {
        console.error('RYDO: leaveRide error:', error);
      }
    });

    /* =================================================
       DISCONNECT
    ================================================= */
    socket.on('disconnect', (reason) => {
      console.log(`RYDO: Socket disconnected (${socket.id}): ${reason}`);

      if (socket.rideCode) {
        socket.to(socket.rideCode).emit('userDisconnected', {
          socketId: socket.id,
          memberId: socket.memberId,
          rideCode: socket.rideCode,
          userName: socket.userName,
          role: socket.role,
        });
      }
    });
  });

  console.log('RYDO: Socket.IO READY');
}

module.exports = initializeRideSocket;