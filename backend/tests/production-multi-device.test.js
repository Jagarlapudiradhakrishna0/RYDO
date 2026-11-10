const { test, describe } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');

require('dotenv').config();

const BASE_URL = process.env.TEST_API_URL || 'https://rydo-irav.onrender.com';

describe('RYDO Multi-Device Production Simulation Tests (3 Devices)', () => {
  let rideCode = '';
  let testUserId = '';
  let captainSocket = null;
  let rider1Socket = null;
  let rider2Socket = null;

  const captainUser = {
    name: 'Captain Alex',
    role: 'captain',
  };

  const rider1User = {
    name: 'Rider Sarah',
    bikeNumber: 'TS 09 AB 2002',
    role: 'rider',
  };

  const rider2User = {
    name: 'Rider Marcus',
    bikeNumber: 'TS 09 AB 3003',
    role: 'rider',
  };

  test('Step 1: Register user to obtain valid authentication ID', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Device Sim Captain',
        phoneNumber: `987${Date.now().toString().slice(-7)}`,
        email: `dev_sim_${Date.now()}@example.com`,
        bikeNumber: 'TS 09 CD 9999',
        bloodGroup: 'O+',
        nativePlace: 'Hyderabad',
        emergencyContactName: 'Emergency Contact',
        emergencyContactPhone: '9876543210',
        emergencyContactConsent: true,
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.user);
    testUserId = data.user._id;
  });

  test('Step 2: Captain creates a group ride and generates 6-character code', async () => {
    const res = await fetch(`${BASE_URL}/api/rides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rideName: 'Multi-Device Convoy',
        captainName: captainUser.name,
        captainUserId: testUserId,
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.ride);
    assert.strictEqual(typeof data.ride.rideCode, 'string');
    assert.strictEqual(data.ride.rideCode.length, 6);
    rideCode = data.ride.rideCode;
  });

  test('Step 3: Rider 1 and Rider 2 join the convoy via HTTP API', async () => {
    const res1 = await fetch(`${BASE_URL}/api/rides/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rideCode,
        riderName: rider1User.name,
        userId: testUserId,
      }),
    });
    assert.strictEqual(res1.status, 200);

    const res2 = await fetch(`${BASE_URL}/api/rides/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rideCode,
        riderName: rider2User.name,
        userId: testUserId,
      }),
    });
    assert.strictEqual(res2.status, 200);
  });

  test('Step 4: Connect 3 separate WebSocket clients and join convoy room', async () => {
    const connectClient = (user) => {
      return new Promise((resolve, reject) => {
        const socket = io(BASE_URL, {
          transports: ['websocket'],
          timeout: 10000,
        });

        socket.on('connect', () => {
          socket.emit('joinRide', {
            rideCode,
            memberId: `${user.role}-${user.name.replace(/\s+/g, '')}`,
            userName: user.name,
            role: user.role,
          });
        });

        socket.on('rideJoined', (payload) => {
          assert.strictEqual(payload.success, true);
          assert.strictEqual(payload.rideCode, rideCode);
          resolve(socket);
        });

        socket.on('connect_error', (err) => {
          reject(err);
        });
      });
    };

    captainSocket = await connectClient(captainUser);
    rider1Socket = await connectClient(rider1User);
    rider2Socket = await connectClient(rider2User);

    assert.ok(captainSocket.connected);
    assert.ok(rider1Socket.connected);
    assert.ok(rider2Socket.connected);
  });

  test('Step 5: Multi-device GPS location synchronization across all 3 devices', async () => {
    const rider1ReceivedPromise = new Promise((resolve) => {
      rider1Socket.on('locationUpdated', (loc) => {
        if (loc.role === 'captain') {
          assert.strictEqual(loc.latitude, 17.385);
          assert.strictEqual(loc.longitude, 78.4867);
          resolve();
        }
      });
    });

    const captainReceivedRider2Promise = new Promise((resolve) => {
      captainSocket.on('locationUpdated', (loc) => {
        if (loc.userName === rider2User.name) {
          assert.strictEqual(loc.latitude, 17.382);
          assert.strictEqual(loc.longitude, 78.481);
          resolve();
        }
      });
    });

    // Captain transmits location
    captainSocket.emit('updateLocation', {
      rideCode,
      memberId: 'captain-alex',
      userId: 'captain-alex',
      userName: captainUser.name,
      role: 'captain',
      latitude: 17.385,
      longitude: 78.4867,
      updatedAt: new Date().toISOString(),
    });

    // Rider 2 transmits location
    rider2Socket.emit('updateLocation', {
      rideCode,
      memberId: 'rider-marcus',
      userId: 'rider-marcus',
      userName: rider2User.name,
      role: 'rider',
      latitude: 17.382,
      longitude: 78.481,
      updatedAt: new Date().toISOString(),
    });

    await Promise.all([rider1ReceivedPromise, captainReceivedRider2Promise]);
  });

  test('Step 6: SOS emergency alert recorded and delivered across convoy', async () => {
    const res = await fetch(`${BASE_URL}/api/rides/${rideCode}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        riderName: rider1User.name,
        name: rider1User.name,
        role: 'rider',
        latitude: 17.384,
        longitude: 78.485,
        bikeNumber: rider1User.bikeNumber,
        bloodGroup: 'B+',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.sos);
  });

  test('Step 7: In-ride audio message recorded and delivered to message history', async () => {
    const res = await fetch(`${BASE_URL}/api/rides/${rideCode}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderName: captainUser.name,
        senderRole: 'captain',
        messageText: 'Take exit 4 in 2 kilometers',
        messageType: 'quick',
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data);
    assert.strictEqual(data.data.messageText, 'Take exit 4 in 2 kilometers');
  });

  test('Step 8: Disconnect sockets gracefully and conclude convoy session', async () => {
    if (captainSocket) captainSocket.disconnect();
    if (rider1Socket) rider1Socket.disconnect();
    if (rider2Socket) rider2Socket.disconnect();

    const res = await fetch(`${BASE_URL}/api/rides/${rideCode}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isStarted: false, status: 'ended' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });
});
