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
const RideMessage = require('../models/RideMessage');

/* =====================================================
   IN-MEMORY ACTIVE RIDE STORE
===================================================== */

const rideRooms = new Map();

/* =====================================================
   IN-MEMORY VOICE ROOM STORE
   voiceRooms: Map<rideCode, {
     members: Map<socketId, { userName, role, memberId }>,
     activeSpeaker: socketId | null,
     activeSpeakerName: string | null,
   }>
===================================================== */

const voiceRooms = new Map();

function getOrCreateVoiceRoom(rideCode) {
  const code = String(rideCode || '').toUpperCase().trim();
  if (!voiceRooms.has(code)) {
    voiceRooms.set(code, {
      members: new Map(),
      activeSpeaker: null,
      activeSpeakerName: null,
    });
  }
  return voiceRooms.get(code);
}

function getVoiceRoomState(rideCode) {
  const room = voiceRooms.get(String(rideCode || '').toUpperCase().trim());
  if (!room) return { members: [], activeSpeaker: null, activeSpeakerName: null };
  return {
    members: Array.from(room.members.values()),
    activeSpeaker: room.activeSpeaker,
    activeSpeakerName: room.activeSpeakerName,
  };
}

function removeFromVoiceRoom(socket) {
  const rideCode = socket.rideCode;
  if (!rideCode) return;
  const room = voiceRooms.get(rideCode);
  if (!room) return;
  room.members.delete(socket.id);
  // Release speaker lock if this socket held it
  if (room.activeSpeaker === socket.id) {
    room.activeSpeaker = null;
    room.activeSpeakerName = null;
    socket.to(rideCode).emit('voice:available', { rideCode });
    socket.to(rideCode).emit('voice:speaker', { rideCode, activeSpeaker: null, activeSpeakerName: null });
  }
  socket.to(rideCode).emit('voice:member-left', {
    rideCode,
    socketId: socket.id,
    memberId: socket.memberId,
    userName: socket.userName,
    role: socket.role,
    state: getVoiceRoomState(rideCode),
  });
}

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

        let activeSosEvents = [];
        try {
          const snapshotRide = await Ride.findOne({ rideCode });
          if (snapshotRide && Array.isArray(snapshotRide.sosEvents)) {
            activeSosEvents = snapshotRide.sosEvents
              .filter((e) => e.status === 'active')
              .map((e) => ({
                eventId: e._id.toString(),
                sosId: e._id.toString(),
                rideCode,
                name: e.name || e.riderName,
                riderName: e.riderName || e.name,
                role: e.role || 'rider',
                userId: e.userId,
                bikeNumber: e.bikeNumber,
                bloodGroup: e.bloodGroup,
                emergencyContact: e.emergencyContact,
                location: {
                  latitude: e.latitude,
                  longitude: e.longitude,
                },
                latitude: e.latitude,
                longitude: e.longitude,
                triggeredAt: e.triggeredAt ? new Date(e.triggeredAt).toISOString() : new Date().toISOString(),
                createdAt: e.triggeredAt ? new Date(e.triggeredAt).toISOString() : new Date().toISOString(),
                status: e.status,
              }));
          }
        } catch (e) { }

        socket.emit('locationsSnapshot', {
          success: true,
          rideCode,
          captainLocation: roomState.captainLocation,
          riders: ridersSnapshot,
          activeSos: activeSosEvents,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error('RYDO: requestLocationSnapshot error:', e);
      }
    });

    /* =================================================
       TRIGGER SOS (SOCKET EVENT)
       Event: triggerSos
    ================================================= */
    socket.on('triggerSos', async (data) => {
      try {
        if (!data) return;
        const rideCode = String(data.rideCode || socket.rideCode || '').toUpperCase().trim();
        if (!rideCode) return;

        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const senderName = String(data.name || data.userName || data.riderName || socket.userName || 'Ride Member').trim();
        const senderRole = String(data.role || socket.role || 'rider').toLowerCase();
        const senderUserId = data.userId || socket.userId || socket.memberId || null;

        const rideDoc = await Ride.findOne({ rideCode });
        if (!rideDoc) return;

        // Deduplicate rapid consecutive SOS triggers within 5 seconds for same ride & sender
        const lastSos = Array.isArray(rideDoc.sosEvents) && rideDoc.sosEvents.length > 0
          ? rideDoc.sosEvents[rideDoc.sosEvents.length - 1]
          : null;

        if (
          lastSos &&
          lastSos.status === 'active' &&
          (Date.now() - new Date(lastSos.triggeredAt || lastSos.createdAt).getTime()) < 5000 &&
          (lastSos.name === senderName || lastSos.riderName === senderName)
        ) {
          console.log('[RYDO SOS] Deduplicating rapid socket triggerSos for:', senderName);
          const sosPayload = {
            eventId: lastSos._id.toString(),
            sosId: lastSos._id.toString(),
            rideCode,
            name: lastSos.name || senderName,
            riderName: lastSos.riderName || senderName,
            role: lastSos.role || senderRole,
            userId: lastSos.userId,
            bikeNumber: lastSos.bikeNumber,
            bloodGroup: lastSos.bloodGroup,
            emergencyContact: lastSos.emergencyContact,
            location: {
              latitude: lastSos.latitude,
              longitude: lastSos.longitude,
            },
            latitude: lastSos.latitude,
            longitude: lastSos.longitude,
            triggeredAt: (lastSos.triggeredAt || new Date()).toISOString(),
            createdAt: (lastSos.triggeredAt || new Date()).toISOString(),
            status: 'active',
          };
          io.to(rideCode).emit('sosAlert', sosPayload);
          return;
        }

        let userProfile = null;
        if (senderUserId && String(senderUserId).match(/^[0-9a-fA-F]{24}$/)) {
          userProfile = await User.findById(senderUserId);
        }
        if (!userProfile && senderName) {
          userProfile = await User.findOne({ name: new RegExp(`^${senderName}$`, 'i') });
        }

        const sosEvent = {
          name: senderName,
          riderName: senderName,
          role: senderRole,
          userId: userProfile ? String(userProfile._id) : senderUserId,
          bikeNumber: userProfile?.bikeNumber || null,
          bloodGroup: userProfile?.bloodGroup || null,
          emergencyContact: userProfile?.emergencyContact
            ? {
              name: userProfile.emergencyContact.name,
              phoneNumber: userProfile.emergencyContact.phoneNumber,
            }
            : { name: null, phoneNumber: null },
          status: 'active',
          latitude: lat,
          longitude: lng,
          triggeredAt: new Date(),
        };

        rideDoc.sosEvents.push(sosEvent);
        await rideDoc.save();

        const savedEvent = rideDoc.sosEvents[rideDoc.sosEvents.length - 1];
        const sosPayload = {
          eventId: savedEvent._id.toString(),
          sosId: savedEvent._id.toString(),
          rideCode,
          name: senderName,
          riderName: senderName,
          role: senderRole,
          userId: sosEvent.userId,
          bikeNumber: sosEvent.bikeNumber,
          bloodGroup: sosEvent.bloodGroup,
          emergencyContact: sosEvent.emergencyContact,
          location: {
            latitude: lat,
            longitude: lng,
          },
          latitude: lat,
          longitude: lng,
          triggeredAt: sosEvent.triggeredAt.toISOString(),
          createdAt: sosEvent.triggeredAt.toISOString(),
          status: 'active',
        };

        console.log('[RYDO SOS] Saved:', sosPayload.eventId);
        console.log('[RYDO SOS] Broadcast:', {
          rideCode,
          name: senderName,
          role: senderRole,
          lat,
          lng,
        });

        io.to(rideCode).emit('sosAlert', sosPayload);
        io.to(rideCode).emit('sosTriggered', sosPayload);
      } catch (err) {
        console.error('RYDO: triggerSos socket error:', err);
      }
    });

    /* =================================================
       RIDE COMMUNICATION - SEND MESSAGE
       Event: 'ride:message:send' (and alias 'sendMessage')
       Data: {
         messageId,
         rideCode,
         senderId,
         senderName,
         senderRole,
         messageText,
         messageType,
         timestamp
       }
    ================================================= */
    const handleSendMessage = async (data, callback) => {
      try {
        if (!data) return;
        const rideCode = String(data.rideCode || socket.rideCode || '').toUpperCase().trim();
        const senderName = String(data.senderName || socket.userName || 'Anonymous').trim();
        const senderRole = String(data.senderRole || socket.role || 'rider').toLowerCase().trim();
        const senderId = String(data.senderId || socket.memberId || socket.userId || '').trim() || null;
        const messageText = String(data.messageText || '').trim();
        const messageType = ['quick', 'custom', 'system'].includes(data.messageType) ? data.messageType : 'quick';
        const messageId = String(data.messageId || '').trim() || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const timestamp = data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString();

        if (!rideCode || !messageText) {
          if (typeof callback === 'function') callback({ success: false, error: 'Missing rideCode or messageText' });
          return;
        }

        // Verify ride existence in database (non-blocking)
        try {
          const rideDoc = await Ride.findOne({ rideCode: new RegExp(`^${rideCode}$`, 'i') });
          if (!rideDoc) {
            console.log(`[RYDO COMM] Notice: Ride ${rideCode} document not found in DB, proceeding with room broadcast.`);
          }
        } catch (e) {
          console.log('[RYDO COMM] Ride doc lookup error (non-fatal):', e);
        }

        // Persist message in MongoDB (idempotent)
        let rideMsg = await RideMessage.findOne({ messageId });
        if (!rideMsg) {
          rideMsg = await RideMessage.create({
            messageId,
            rideCode,
            senderId,
            senderName,
            senderRole: senderRole === 'captain' ? 'captain' : senderRole === 'system' ? 'system' : 'rider',
            messageText,
            messageType,
            createdAt: new Date(timestamp),
          });
        }

        const messagePayload = {
          messageId: rideMsg.messageId,
          rideCode: rideMsg.rideCode,
          senderId: rideMsg.senderId,
          senderName: rideMsg.senderName,
          senderRole: rideMsg.senderRole,
          messageText: rideMsg.messageText,
          messageType: rideMsg.messageType,
          timestamp: rideMsg.createdAt ? rideMsg.createdAt.toISOString() : new Date().toISOString(),
          createdAt: rideMsg.createdAt ? rideMsg.createdAt.toISOString() : new Date().toISOString(),
        };

        console.log(`[SEND] rideCode=${rideCode} sender=${senderName} role=${senderRole} message="${messageText}"`);
        console.log(`[BROADCAST] event=ride:message:new room=${rideCode}`);

        // Broadcast to ALL members in this ride room in real-time
        io.to(rideCode).emit('ride:message:new', messagePayload);
        io.to(rideCode).emit('messageReceived', messagePayload);

        if (typeof callback === 'function') {
          callback({ success: true, message: messagePayload });
        }
      } catch (err) {
        console.error('RYDO: ride:message:send socket error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    };

    socket.on('ride:message:send', handleSendMessage);
    socket.on('sendMessage', handleSendMessage);

    /* =================================================
       START / END RIDE
    ================================================= */
    socket.on('startRide', async (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        if (!rideCode) return;
        console.log(`[RIDESTART] Socket startRide received for ${rideCode}`);
        await Ride.findOneAndUpdate(
          { rideCode },
          { $set: { isStarted: true, status: 'live' } }
        );
        io.to(rideCode).emit('ride:started', { rideCode, isStarted: true, status: 'live' });
        io.to(rideCode).emit('rideStarted', { rideCode, isStarted: true, status: 'live' });
      } catch (err) {
        console.error('RYDO: startRide socket error:', err);
      }
    });

    socket.on('endRide', async (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        if (!rideCode) return;
        console.log(`[RIDESTART] Socket endRide received for ${rideCode}`);
        await Ride.findOneAndUpdate(
          { rideCode },
          { $set: { isStarted: false, status: 'ended' } }
        );
        io.to(rideCode).emit('ride:ended', { rideCode, isStarted: false, status: 'ended' });
        io.to(rideCode).emit('rideEnded', { rideCode, isStarted: false, status: 'ended' });
      } catch (err) {
        console.error('RYDO: endRide socket error:', err);
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
        const roomState = rideRooms.get(rideCode);
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
                rDoc.save().catch(() => { });
              }
            }
          }).catch(() => { });
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
       VOICE COMMUNICATION - SIGNALING
       Group push-to-talk voice via WebRTC signaling
    ================================================= */

    /* voice:join — user enters the voice room */
    socket.on('voice:join', (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        const userName = String(data?.userName || socket.userName || 'Unknown');
        const role = String(data?.role || socket.role || 'rider');
        const memberId = String(data?.memberId || socket.memberId || socket.id);

        if (!rideCode) return;

        const room = getOrCreateVoiceRoom(rideCode);
        room.members.set(socket.id, { socketId: socket.id, userName, role, memberId });

        console.log(`[VOICE] ${userName} (${role}) joined voice room ${rideCode}`);

        // Tell new joiner current state + all existing peer socket IDs to initiate offers
        const currentState = getVoiceRoomState(rideCode);
        const existingPeers = Array.from(room.members.entries())
          .filter(([sid]) => sid !== socket.id)
          .map(([sid, info]) => ({ socketId: sid, ...info }));

        socket.emit('voice:state', {
          rideCode,
          state: currentState,
          peers: existingPeers, // Existing peers to initiate WebRTC offers toward
        });

        // Notify others that a new peer joined
        socket.to(rideCode).emit('voice:member-joined', {
          rideCode,
          socketId: socket.id,
          userName,
          role,
          memberId,
          state: currentState,
        });
      } catch (err) {
        console.error('[VOICE] voice:join error:', err);
      }
    });

    /* voice:leave — user exits voice room voluntarily */
    socket.on('voice:leave', (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        if (!rideCode) return;
        removeFromVoiceRoom(socket);
        console.log(`[VOICE] ${socket.userName} left voice room ${rideCode}`);
      } catch (err) {
        console.error('[VOICE] voice:leave error:', err);
      }
    });

    /* voice:request — user wants to speak (push-to-talk press) */
    socket.on('voice:request', (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        if (!rideCode) return;

        const room = voiceRooms.get(rideCode);
        if (!room) {
          socket.emit('voice:denied', { rideCode, reason: 'Voice room not found. Join voice first.' });
          return;
        }

        if (room.activeSpeaker && room.activeSpeaker !== socket.id) {
          // Someone else is speaking — deny
          socket.emit('voice:denied', {
            rideCode,
            reason: `${room.activeSpeakerName || 'Someone'} is speaking. Please wait.`,
            activeSpeakerName: room.activeSpeakerName,
          });
          return;
        }

        // Grant speaker lock
        room.activeSpeaker = socket.id;
        room.activeSpeakerName = socket.userName || data?.userName || 'Unknown';

        socket.emit('voice:granted', { rideCode });

        // Broadcast to everyone that this person is now speaking
        io.to(rideCode).emit('voice:speaker', {
          rideCode,
          activeSpeaker: socket.id,
          activeSpeakerName: room.activeSpeakerName,
          memberId: socket.memberId,
        });

        console.log(`[VOICE] ${room.activeSpeakerName} acquired speaker lock in ${rideCode}`);
      } catch (err) {
        console.error('[VOICE] voice:request error:', err);
      }
    });

    /* voice:release — user releases push-to-talk */
    socket.on('voice:release', (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        if (!rideCode) return;

        const room = voiceRooms.get(rideCode);
        if (!room) return;

        if (room.activeSpeaker !== socket.id) return; // Only current speaker can release

        const prevSpeakerName = room.activeSpeakerName;
        room.activeSpeaker = null;
        room.activeSpeakerName = null;

        io.to(rideCode).emit('voice:speaker', {
          rideCode,
          activeSpeaker: null,
          activeSpeakerName: null,
        });
        io.to(rideCode).emit('voice:available', { rideCode });

        console.log(`[VOICE] ${prevSpeakerName} released speaker lock in ${rideCode}`);
      } catch (err) {
        console.error('[VOICE] voice:release error:', err);
      }
    });

    /* voice:offer — WebRTC SDP offer forwarded to specific peer */
    socket.on('voice:offer', (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        const targetSocketId = data?.targetSocketId;
        if (!rideCode || !targetSocketId || !data?.sdp) return;

        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (!targetSocket) {
          socket.emit('voice:error', { error: 'Target peer not found', targetSocketId });
          return;
        }

        targetSocket.emit('voice:offer', {
          rideCode,
          fromSocketId: socket.id,
          fromUserName: socket.userName,
          fromRole: socket.role,
          sdp: data.sdp,
        });
      } catch (err) {
        console.error('[VOICE] voice:offer error:', err);
      }
    });

    /* voice:answer — WebRTC SDP answer forwarded back */
    socket.on('voice:answer', (data) => {
      try {
        const targetSocketId = data?.targetSocketId;
        if (!targetSocketId || !data?.sdp) return;

        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (!targetSocket) return;

        targetSocket.emit('voice:answer', {
          rideCode: data.rideCode,
          fromSocketId: socket.id,
          fromUserName: socket.userName,
          sdp: data.sdp,
        });
      } catch (err) {
        console.error('[VOICE] voice:answer error:', err);
      }
    });

    /* voice:ice-candidate — ICE candidate forwarded to peer */
    socket.on('voice:ice-candidate', (data) => {
      try {
        const targetSocketId = data?.targetSocketId;
        if (!targetSocketId || !data?.candidate) return;

        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (!targetSocket) return;

        targetSocket.emit('voice:ice-candidate', {
          rideCode: data.rideCode,
          fromSocketId: socket.id,
          candidate: data.candidate,
        });
      } catch (err) {
        console.error('[VOICE] voice:ice-candidate error:', err);
      }
    });

    /* voice:state — request current voice room state */
    socket.on('voice:state', (data) => {
      try {
        const rideCode = String(data?.rideCode || socket.rideCode || '').toUpperCase().trim();
        socket.emit('voice:state', {
          rideCode,
          state: getVoiceRoomState(rideCode),
          peers: [],
        });
      } catch (err) {
        console.error('[VOICE] voice:state error:', err);
      }
    });

    /* =================================================
       DISCONNECT (with voice cleanup)
    ================================================= */
    socket.on('disconnect', (reason) => {
      console.log(`RYDO: Socket disconnected (${socket.id}): ${reason}`);

      // Voice room cleanup on disconnect
      removeFromVoiceRoom(socket);

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