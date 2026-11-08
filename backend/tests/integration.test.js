const { test, describe } = require('node:test');
const assert = require('node:assert');

// Load environment variables
require('dotenv').config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

describe('RYDO Backend Integration Tests', () => {
  let createdRideCode = '';
  let testUserEmail = `test_rider_${Date.now()}@example.com`;
  let testUserId = '';

  test('GET /api/health should return running status', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.message.includes('running'));
  });

  test('GET / should return online status', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.status, 'online');
  });

  test('GET /socket-status should return Socket.IO server status', async () => {
    const res = await fetch(`${BASE_URL}/socket-status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(typeof data.connectedClients, 'number');
  });

  test('POST /api/auth/register should register a new user', async () => {
    const payload = {
      name: 'Integration Test Rider',
      phoneNumber: '9876543210',
      email: testUserEmail,
      bikeNumber: 'TS 09 AB 1234',
      bloodGroup: 'O+',
      nativePlace: 'Hyderabad',
      emergencyContactName: 'Emergency Contact',
      emergencyContactPhone: '9876543211',
      emergencyContactConsent: true,
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    };

    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.ok(data.user);
    assert.strictEqual(data.user.email, testUserEmail.toLowerCase());
    testUserId = data.user._id;
  });

  test('POST /api/auth/login should authenticate registered user', async () => {
    const payload = {
      email: testUserEmail,
      password: 'SecurePassword123!',
    };

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.user);
    assert.strictEqual(data.user.email, testUserEmail.toLowerCase());
  });

  test('POST /api/rides should create a group ride and generate a 6-character code', async () => {
    const payload = {
      rideName: 'Test Deccan Convoy',
      captainName: 'Test Captain',
      captainUserId: testUserId,
    };

    const res = await fetch(`${BASE_URL}/api/rides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.ok(data.ride);
    assert.strictEqual(typeof data.ride.rideCode, 'string');
    assert.strictEqual(data.ride.rideCode.length, 6);
    createdRideCode = data.ride.rideCode;
  });

  test('GET /api/rides/:rideCode should retrieve created ride details', async () => {
    assert.ok(createdRideCode, 'Ride code must exist from creation test');
    const res = await fetch(`${BASE_URL}/api/rides/${createdRideCode}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.ride.rideCode, createdRideCode);
    assert.strictEqual(data.ride.rideName, 'Test Deccan Convoy');
  });

  test('POST /api/rides/join should allow a rider to join by rideCode', async () => {
    const payload = {
      rideCode: createdRideCode,
      riderName: 'Convoy Member 1',
      userId: testUserId,
    };

    const res = await fetch(`${BASE_URL}/api/rides/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.ride);
    const riderExists = data.ride.riders.some(r => r.name === 'Convoy Member 1');
    assert.strictEqual(riderExists, true);
  });

  test('PATCH /api/rides/:rideCode/status should set ride to live status', async () => {
    const payload = {
      isStarted: true,
    };

    const res = await fetch(`${BASE_URL}/api/rides/${createdRideCode}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.ride.isStarted, true);
    assert.strictEqual(data.ride.status, 'live');
  });

  test('POST /api/rides/:rideCode/sos should record emergency SOS alert', async () => {
    const payload = {
      riderName: 'Convoy Member 1',
      role: 'rider',
      latitude: 17.385,
      longitude: 78.4867,
      message: 'SOS: Engine failure at highway junction',
    };

    const res = await fetch(`${BASE_URL}/api/rides/${createdRideCode}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.sos);
    assert.strictEqual(data.sos.name, 'Convoy Member 1');
  });

  test('POST /api/rides/:rideCode/messages should record in-ride communication message', async () => {
    const payload = {
      senderId: testUserId,
      senderName: 'Convoy Member 1',
      senderRole: 'rider',
      messageText: 'Regroup at next milestone',
      messageType: 'quick',
    };

    const res = await fetch(`${BASE_URL}/api/rides/${createdRideCode}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.ok(data.data);
    assert.strictEqual(data.data.messageText, 'Regroup at next milestone');
  });

  test('GET /api/rides/:rideCode/messages should fetch message history', async () => {
    const res = await fetch(`${BASE_URL}/api/rides/${createdRideCode}/messages`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.messages));
    assert.ok(data.messages.length >= 1);
  });

  test('PATCH /api/rides/:rideCode/status should conclude the ride', async () => {
    const payload = {
      isStarted: false,
    };

    const res = await fetch(`${BASE_URL}/api/rides/${createdRideCode}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.ride.isStarted, false);
    assert.strictEqual(data.ride.status, 'ended');
  });
});
