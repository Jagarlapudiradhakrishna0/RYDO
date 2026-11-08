# RYDO — API & Real-Time WebSocket Documentation

Complete technical specification for the RYDO REST API endpoints and Socket.IO real-time event protocol.

---

## Base URLs
* **Production REST API:** `https://rydo-irav.onrender.com`
* **Local Development (Emulator):** `http://10.0.2.2:5000`
* **Local Development (Physical Device):** `http://<YOUR_LAN_IP>:5000`
* **Localhost:** `http://localhost:5000`

---

## 1. System & Health Endpoints

### 1.1 Health Check
* **Method:** `GET`
* **Path:** `/api/health`
* **Description:** Verifies that the Express application is running and accessible.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "RYDO backend is running"
}
```

### 1.2 Socket Status
* **Method:** `GET`
* **Path:** `/socket-status`
* **Description:** Reports the active status of the Socket.IO server and connected client count.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "RYDO Socket.IO server is running",
  "connectedClients": 2
}
```

---

## 2. Authentication API (`/api/auth`)

### 2.1 Register User
* **Method:** `POST`
* **Path:** `/api/auth/register`
* **Request Body:**
```json
{
  "name": "Alex Johnson",
  "phoneNumber": "9876543210",
  "email": "alex@example.com",
  "bikeNumber": "TS 09 AB 1234",
  "bloodGroup": "O+",
  "nativePlace": "Hyderabad",
  "emergencyContactName": "Sarah Johnson",
  "emergencyContactPhone": "9876543211",
  "emergencyContactConsent": true,
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```
* **Validation Rules:**
  * `name`: String, minimum 2 characters.
  * `phoneNumber`: Valid 10-digit Indian phone number starting with 6, 7, 8, or 9.
  * `bikeNumber`: Alphanumeric, 6-12 characters, normalized to standard vehicle format.
  * `bloodGroup`: One of `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`.
  * `emergencyContactPhone`: Cannot be identical to the rider's own phone number.
  * `emergencyContactConsent`: Must be `true`.
  * `password`: Minimum 8 characters with at least one number and one letter.
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "_id": "6724a1b2c3d4e5f6a7b8c9d0",
    "name": "Alex Johnson",
    "email": "alex@example.com",
    "phoneNumber": "+919876543210",
    "bikeNumber": "TS 09 AB 1234",
    "bloodGroup": "O+",
    "nativePlace": "Hyderabad",
    "emergencyContact": {
      "name": "Sarah Johnson",
      "phoneNumber": "+919876543211"
    },
    "emergencyContactConsent": true,
    "createdAt": "2026-11-08T12:00:00.000Z"
  }
}
```

### 2.2 Login User
* **Method:** `POST`
* **Path:** `/api/auth/login`
* **Request Body:**
```json
{
  "email": "alex@example.com",
  "password": "SecurePassword123!"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "6724a1b2c3d4e5f6a7b8c9d0",
    "name": "Alex Johnson",
    "email": "alex@example.com",
    "bikeNumber": "TS 09 AB 1234",
    "bloodGroup": "O+"
  }
}
```

### 2.3 Get Profile
* **Method:** `GET`
* **Path:** `/api/auth/profile/:userId`
* **Response (200 OK):** Returns sanitized user profile with passwords excluded.

---

## 3. Ride Management API (`/api/rides`)

### 3.1 Create Ride (Captain)
* **Method:** `POST`
* **Path:** `/api/rides`
* **Request Body:**
```json
{
  "rideName": "Western Ghats Convoy",
  "captainName": "Alex Johnson",
  "captainUserId": "6724a1b2c3d4e5f6a7b8c9d0"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Ride created successfully",
  "ride": {
    "rideCode": "H7X9QK",
    "rideName": "Western Ghats Convoy",
    "captainName": "Alex Johnson",
    "status": "ready",
    "isStarted": false,
    "riders": [],
    "route": {
      "start": null,
      "destination": null,
      "stops": [],
      "coordinates": []
    }
  }
}
```

### 3.2 Join Ride (Rider)
* **Method:** `POST`
* **Path:** `/api/rides/join`
* **Request Body:**
```json
{
  "rideCode": "H7X9QK",
  "riderName": "Rahul Sharma",
  "userId": "6724a1b2c3d4e5f6a7b8c9d1"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Joined ride successfully",
  "ride": {
    "rideCode": "H7X9QK",
    "rideName": "Western Ghats Convoy",
    "captainName": "Alex Johnson",
    "riders": [
      {
        "name": "Rahul Sharma",
        "userId": "6724a1b2c3d4e5f6a7b8c9d1",
        "joinedAt": "2026-11-08T12:05:00.000Z"
      }
    ]
  }
}
```

### 3.3 Get Ride Details
* **Method:** `GET`
* **Path:** `/api/rides/:rideCode`
* **Response (200 OK):** Complete ride document with captain location, member list, route coordinates, and active SOS events.

### 3.4 Update Ride Status (Start / Conclude)
* **Method:** `PATCH`
* **Path:** `/api/rides/:rideCode/status`
* **Request Body (Start Ride):**
```json
{
  "isStarted": true
}
```
* **Request Body (End Ride):**
```json
{
  "isStarted": false
}
```

### 3.5 Update Route & Waypoints
* **Method:** `PATCH`
* **Path:** `/api/rides/:rideCode/route`
* **Request Body:**
```json
{
  "start": { "name": "Hyderabad", "latitude": 17.3850, "longitude": 78.4867 },
  "destination": { "name": "Warangal", "latitude": 17.9789, "longitude": 79.5076 },
  "stops": [],
  "coordinates": [
    { "latitude": 17.3850, "longitude": 78.4867 },
    { "latitude": 17.9789, "longitude": 79.5076 }
  ],
  "distanceKm": 145.2,
  "durationMinutes": 160
}
```

### 3.6 Broadcast SOS Emergency Alert
* **Method:** `POST`
* **Path:** `/api/rides/:rideCode/sos`
* **Request Body:**
```json
{
  "riderName": "Rahul Sharma",
  "role": "rider",
  "latitude": 17.5501,
  "longitude": 78.8920,
  "message": "Accident at highway toll gate, medical assistance required"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "SOS sent successfully. Emergency contact and crew alerted.",
  "sos": {
    "eventId": "sos_1731052800000_abc123",
    "name": "Rahul Sharma",
    "role": "rider",
    "latitude": 17.5501,
    "longitude": 78.8920,
    "status": "active",
    "triggeredAt": "2026-11-08T12:10:00.000Z"
  }
}
```

### 3.7 In-Ride Chat Messages
* **Send Message (`POST /api/rides/:rideCode/messages`):**
```json
{
  "senderId": "6724a1b2c3d4e5f6a7b8c9d1",
  "senderName": "Rahul Sharma",
  "senderRole": "rider",
  "messageText": "Stopping for fuel in 2 km",
  "messageType": "quick"
}
```
* **Fetch History (`GET /api/rides/:rideCode/messages`):** Returns array of chronological messages.

---

## 4. Socket.IO WebSocket Specification

Clients connect to the root namespace `/` with transport fallbacks:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
```

### 4.1 Client Emit Events

| Event | Parameters | Description |
| :--- | :--- | :--- |
| `joinRide` | `{ rideCode, userId, userName, role }` | Enters ride room and triggers snapshot |
| `updateLocation` | `{ rideCode, userId, userName, role, latitude, longitude, updatedAt }` | Telemetry broadcast |
| `ride:message:send`| `{ rideCode, messageText, messageType }` | In-ride communication broadcast |
| `leaveRide` | None | Leaves active room and removes live marker |

### 4.2 Server Broadcast Events

| Event | Target | Payload |
| :--- | :--- | :--- |
| `rideJoined` | Socket only | Confirmation of room entrance |
| `locationsSnapshot` | Socket only | Full captain and rider location list |
| `locationUpdated` | Room | Live coordinate packet for single user |
| `sosAlert` | Room | Emergency distress signal packet |
| `ride:message:new` | Room | Broadcast of new chat/announcement message |
| `ride:started` | Room | Convoy departure trigger |
| `ride:ended` | Room | Convoy completion trigger |
| `userJoined` | Room | Member joined announcement |
| `userLeft` | Room | Member departed announcement |

