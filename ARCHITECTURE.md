# RYDO — System Architecture & Technical Specifications

This document defines the high-level and component architectures of the RYDO real-time group ride coordination platform.

---

## 1. Architectural Overview

RYDO employs a modern decoupled client-server architecture consisting of a React Native mobile application built on Expo SDK 58 and a resilient Node.js / Express backend with a Socket.IO real-time event pipeline and MongoDB persistence.

```
                      ┌─────────────────────────────────┐
                      │    Mobile App (Expo SDK 58)     │
                      │  - Screens & State Machine      │
                      │  - Singleton SocketService      │
                      │  - Leaflet / RydoMap Bridge     │
                      │  - Local Voice (TTS) Engine     │
                      └──────────────┬───▲──────────────┘
                                     │   │
                         REST (HTTP) │   │ WebSockets (WS)
                                     │   │
                      ┌──────────────▼───┴──────────────┐
                      │  Node.js / Express 5.3 Backend   │
                      │  - Router & Request Logger      │
                      │  - PBKDF2 Crypto Hashing        │
                      │  - Socket.IO Gateway            │
                      │  - In-Memory Geolocation Buffer │
                      │  - Graceful Shutdown Controller │
                      └──────────────┬──────────────────┘
                                     │
                             Mongoose 9.12 ODM
                                     │
                      ┌──────────────▼──────────────────┐
                      │     MongoDB Atlas Cluster       │
                      │  - users Collection             │
                      │  - rides Collection             │
                      │  - ridemessages Collection      │
                      └─────────────────────────────────┘
```

---

## 2. Real-Time Telemetry & Socket Flow

### Room-Based Subscriptions
Each ride creates an isolated Socket.IO room identified by its 6-character `rideCode` (e.g. `E4JJLB`).

```
Mobile Client A (Captain)                Backend (Socket.IO)               Mobile Client B (Rider)
       │                                         │                                    │
       │── joinRide(rideCode, 'captain') ───────►│                                    │
       │◄── locationsSnapshot (Full state) ──────│                                    │
       │                                         │◄── joinRide(rideCode, 'rider') ────│
       │                                         │─── locationsSnapshot ─────────────►│
       │                                         │                                    │
       │── updateLocation(lat, lng) ────────────►│                                    │
       │                                         │─── locationUpdated(lat, lng) ─────►│
       │                                         │                                    │
       │                                         │◄── updateLocation(lat, lng) ───────│
       │◄── locationUpdated(lat, lng) ───────────│                                    │
       │                                         │                                    │
       │                                         │◄── sosAlert(distress details) ─────│
       │◄── sosAlert (Screen Flash + Alert) ─────│                                    │
```

### In-Memory Buffering & Throttled Persistence
High-frequency GPS broadcasts (emitted every 3–5 seconds by moving vehicles) do not hit MongoDB on every tick:
1. Coordinates are stored in backend memory (`rideRooms: Map<rideCode, RoomState>`) for instant dispatch to room subscribers.
2. An interval throttles MongoDB updates to write rider coordinates every 10 seconds, preventing write contention on the database cluster while keeping the ride record durable against unexpected server restarts.

---

## 3. Map & Navigation Architecture

RYDO implements a multi-layer map rendering pipeline:
1. **Interactive Leaflet WebView (`components/RydoMap.tsx`):**
   * Encapsulates an HTML5 Leaflet map running in an isolated WebView with custom black-and-white road styling.
   * Renders convoy avatars with live online/offline pulse dots.
   * Renders OSRM road polylines (`#1677FF`) and emergency routes (`#EF4444`).
   * Supports smooth animated camera recentering without full map reloads via `injectJavaScript`.
2. **Turn-by-Turn OSRM Routing Engine:**
   * Calculates driving directions between Start point, multiple Waypoint stops, and Destination.
   * Decodes route coordinates into map polyline points with distance (km) and estimated travel duration (minutes).

---

## 4. Voice Communication & TTS Engine

1. **Quick In-Ride Messages:**
   * Pre-composed highway commands ("Break", "Need fuel", "Stop immediately", "Stay together").
   * Transmitted over REST & Socket.IO.
2. **Text-To-Speech (TTS) Voice Synthesis:**
   * `services/ttsService.ts` integrates with `expo-speech` to synthesize incoming announcements into natural speech.
   * Configurable gender preferences (`male`, `female`, `default`) saved in `AsyncStorage`.
   * Background audio ducking allows speech announcements to be heard above motorcycle engine noise.
3. **SSR Safety Guard:**
   * Window checks (`typeof window !== 'undefined'`) prevent web static rendering errors.

---

## 5. Security & Safety Architecture

1. **PBKDF2 Password Hashing:**
   * Passwords hashed using Node.js `crypto.pbkdf2Sync` with 10,000 iterations, 64-byte key length, and SHA-512.
   * Unique 16-byte random salt generated per user.
   * Verification executed with `crypto.timingSafeEqual` to neutralize timing side-channel attacks.
2. **Data Minimization & Sanitization:**
   * `User.prototype.toSafeObject()` strips `passwordHash` and `passwordSalt` prior to any response serialization.
   * Emergency phone numbers masked when accessed by non-emergency interfaces.
3. **Input Validation:**
   * Normalized vehicle registration numbers (e.g. `TS 09 AB 1234`).
   * Validated 10-digit Indian phone numbers (`+91` format).
   * Strict blood group enumeration (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).

