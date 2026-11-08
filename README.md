# RYDO 🏍️💨 — Real-Time Group Ride Coordination Platform

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-58.0.23-000000.svg?style=flat&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.88.1-61DAFB.svg?style=flat&logo=react)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/React-19.3.0-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.x-339933.svg?style=flat&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.3.0-000000.svg?style=flat&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.8.0-47A248.svg?style=flat&logo=mongodb)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.4-010101.svg?style=flat&logo=socket.io)](https://socket.io/)

**RYDO** is a production-grade, real-time convoy coordination mobile application engineered for motorcycle clubs, cycling pelotons, and group road expeditions. Designed with a black-and-white Apple-inspired Swiss aesthetic, RYDO synchronizes high-frequency GPS locations across all convoy members, renders interactive Leaflet and native map navigation polylines, coordinates group messages with text-to-speech synthesis, and broadcasts instant emergency SOS distress signals.

---

## 📋 Table of Contents

- [Project Vision](#-project-vision)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Modernized Technology Stack](#-modernized-technology-stack)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Mobile App Setup](#2-mobile-app-setup)
- [Environment Configuration](#-environment-configuration)
- [REST API & Socket.IO Reference](#-rest-api--socketio-reference)
- [Testing & Validation](#-testing--validation)
- [Production Deployment](#-production-deployment)
- [Troubleshooting](#-troubleshooting)
- [Security Guidelines](#-security-guidelines)

---

## 🎯 Project Vision

Convoy road travel faces critical challenges: riders get separated at highway junctions, connectivity drops in mountainous terrain, and medical emergencies demand instant location-aware broadcasting. RYDO bridges this gap with:

1. **Sub-second Location Telemetry:** Bi-directional Socket.IO rooms stream GPS updates between Ride Captain and Riders.
2. **Deterministic Route Alignment:** OSRM-powered route planning with turn-by-turn waypoint coordinates and visual map polylines.
3. **One-Tap Emergency SOS:** Emergency distress beacons with blood group, bike registration, emergency contact phone, and exact GPS coordinates broadcast to every convoy member.
4. **Hands-Free Communication:** Quick in-ride announcements read aloud via local Text-To-Speech (TTS) engine, keeping rider eyes on the road.

---

## 🚀 Key Features

* **Captain Mode:**
  * Create rides and generate cryptographically secure 6-character alphanumeric ride codes (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
  * Live convoy monitoring with online/offline rider badges.
  * Start, pause, resume, and conclude rides.
  * Route calculation using OpenStreetMap Nominatim Geocoding and OSRM routing engine.
  * Real-time GPS broadcasting.

* **Rider Mode:**
  * Instant room entry via ride code.
  * Live map view showing Captain and fellow rider coordinates.
  * Auto-reconnection with exponential backoff on intermittent cellular signal.
  * Real-time convoy alerts and notifications.

* **SOS Emergency Safety System:**
  * Persistent SOS registry with GPS coordinate logging.
  * Broadcast alerts sent over WebSockets with 10-second high-visibility pulsing visual overlays.
  * Displays rider blood group, native place, vehicle number, and emergency contact details.

* **In-Ride Communication & Voice Announcements:**
  * Quick convoy commands ("Let's take a break", "Need fuel", "Stop immediately").
  * In-ride chat message history stored in MongoDB with chronological index.
  * Offline-capable Text-To-Speech (TTS) integration reading incoming convoy announcements aloud.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│            RYDO Mobile App (Expo SDK 58)               │
│  - React Native 0.88.1 / React 19.3.0                  │
│  - Expo Router (File-based routing)                    │
│  - Leaflet Web / Native Map Engine                     │
│  - Location Telemetry (expo-location)                  │
│  - Audio & TTS Engine (expo-speech, expo-audio)        │
└───────────────┬────────────────────────▲───────────────┘
                │                        │
         REST API (HTTP)           Socket.IO (WS)
         POST/GET/PATCH/DELETE     Real-time Events
                │                        │
┌───────────────▼────────────────────────┴───────────────┐
│              RYDO Backend Server (Node.js)             │
│  - Express 5.3.0 REST Engine                           │
│  - Socket.IO 4.8.4 WebSocket Gateway                   │
│  - PBKDF2 Password Salt Hashing                        │
│  - In-Memory Throttled Geolocation Buffer              │
│  - Graceful Shutdown (SIGINT/SIGTERM)                  │
└───────────────────────────────┬────────────────────────┘
                                │
                         Mongoose 9.12.0
                                │
┌───────────────────────────────▼────────────────────────┐
│            MongoDB Atlas Database Cluster              │
│  - Users Collection (Auth, Profiles, Contacts)         │
│  - Rides Collection (RideCodes, Status, Locations)     │
│  - RideMessages Collection (Indexed Message History)   │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Modernized Technology Stack

| Component | Upgraded Version | Purpose |
| :--- | :--- | :--- |
| **Mobile Runtime** | Expo SDK **58.0.23** | Latest stable Expo SDK with New Architecture |
| **Mobile Framework** | React Native **0.88.1** | Native cross-platform rendering engine |
| **UI Library** | React **19.3.0** | Modern component rendering |
| **Language** | TypeScript **6.0.3** | Strict type safety and zero-error compilation |
| **Navigation** | Expo Router **~58.0.30** | Type-safe file-based navigation |
| **Location Tracking** | `expo-location` **~58.0.20** | GPS tracking with battery-efficient intervals |
| **Audio & Speech** | `expo-speech` & `expo-audio` **~58.0.11** | In-ride voice alerts and notification sounds |
| **Maps Layer** | `react-native-maps` **1.29.11** & Leaflet | High-performance vector map and live marker tracking |
| **Backend Framework** | Express **5.3.0** | Scalable REST API with security middleware |
| **Real-Time Engine** | Socket.IO **4.8.4** | Low-latency bi-directional WebSocket messaging |
| **Database ODM** | Mongoose **9.12.0** / MongoDB **7.8.0** | Robust document schemas, pools, and indexes |
| **Security** | Node `crypto` (`pbkdf2Sync`, `timingSafeEqual`) | Resistant password salting and constant-time compare |

---

## 📂 Repository Structure

```
RYDO/
├── backend/                       # Express & Socket.IO Real-Time Backend
│   ├── models/                    # Mongoose Schemas (User, Ride, RideMessage)
│   ├── routes/                    # REST Routes (authRoutes, rideRoutes)
│   ├── socket/                    # WebSocket Handlers (rideSocket.js)
│   ├── tests/                     # Integration Test Suite (Node.js Test Runner)
│   ├── .env.example               # Backend Environment Template
│   ├── package.json               # Backend Scripts & Dependencies
│   └── server.js                  # Entry point with Graceful Shutdown
│
├── mobile/                        # Expo SDK 58 React Native Mobile Client
│   ├── app/                       # Expo Router File-Based Screens
│   │   ├── _layout.tsx            # Root Stack & Global Overlay Layout
│   │   ├── index.tsx              # Splash & Welcome Screen
│   │   ├── login.tsx              # Authenticate Existing User
│   │   ├── register.tsx           # Register with Emergency Contact & Bike Details
│   │   ├── ride-choice.tsx        # Captain / Rider Mode Selector
│   │   ├── create-ride.tsx        # Captain Ride Creation
│   │   ├── ride-created.tsx       # Ride Code Sharing Dashboard
│   │   ├── join-ride.tsx          # Rider Entry by Ride Code
│   │   ├── captain-dashboard.tsx  # Captain Command Center
│   │   ├── rider-dashboard.tsx    # Rider Convoy Dashboard
│   │   ├── live-ride-map.tsx      # Interactive Full-Screen Live Tracking
│   │   ├── route-planner.tsx      # Waypoint & Route Configuration
│   │   ├── communication.tsx      # Convoy Chat & Voice Broadcast Screen
│   │   └── profile.tsx            # User Profile, Bike & Emergency Settings
│   ├── components/                # Reusable UI & Overlay Components
│   │   ├── RydoMap.tsx            # Leaflet / WebView Map Wrapper
│   │   ├── MessagePopup.tsx       # Non-intrusive Animated Convoy Notification
│   │   ├── SosButton.tsx          # Instant SOS Trigger Component
│   │   └── SosEmergencyOverlay.tsx # Full-Screen Emergency Red Pulse Alert
│   ├── constants/                 # Network, Theme, Auth Storage Keys
│   ├── services/                  # Socket, TTS, SOS & Settings Services
│   ├── app.json                   # Expo SDK 58 Application Manifest
│   ├── eslint.config.js           # ESLint Flat Config (Expo ~58.0.4)
│   ├── tsconfig.json              # TypeScript 6 Config
│   └── package.json               # Mobile Dependencies & Scripts
│
├── .env.example                   # Root Template Reference
├── README.md                      # Primary Documentation (This File)
├── TEAM_SETUP.md                  # Comprehensive Team Installation Manual
├── API_DOCUMENTATION.md           # Complete REST & WebSocket Contract
├── ARCHITECTURE.md                # System Architecture & Flow Specifications
├── DATABASE_SCHEMA.md             # Mongoose Schemas & MongoDB Indexes
├── TESTING_GUIDE.md               # Backend & Frontend Testing Manual
└── UPGRADE_REPORT.md              # Full Modernization & SDK Upgrade Audit Report
```

---

## 💻 Prerequisites

Ensure you have installed:
- **Node.js:** v20.x or higher (compatible with Node 22+ and 25)
- **npm:** v10.x or higher
- **Git:** Version 2.40+
- **Expo Go (Optional):** Available on Android Google Play Store and iOS App Store for physical device preview.

---

## ⚡ Quick Start Guide

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env and insert your MongoDB connection string
cp .env.example .env

# Run integration tests
npm test

# Start backend server
npm start
```

* Backend runs at `http://localhost:5000`
* Health verification: `http://localhost:5000/api/health`

### 2. Mobile App Setup

```bash
# Navigate to mobile directory
cd ../mobile

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env
cp .env.example .env

# Verify project health
npx expo-doctor
npx tsc --noEmit

# Start Expo development server
npx expo start -c
```

**Mobile Controls in Terminal:**
* Press `a` to launch in an Android Emulator.
* Press `w` to open in your Web Browser.
* Scan the displayed QR Code with the **Expo Go** application on your physical Android phone.

---

## 🌐 Environment Configuration

### Backend (`backend/.env`)

```env
# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/rydo?retryWrites=true&w=majority

# Server Port
PORT=5000
```

### Mobile (`mobile/.env`)

```env
# Option A: Production Cloud Backend (Recommended for Physical Device testing)
EXPO_PUBLIC_API_URL=https://rydo-irav.onrender.com
EXPO_PUBLIC_SOCKET_URL=https://rydo-irav.onrender.com

# Option B: Local Backend (Android Emulator)
# EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
# EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000

# Option C: Local Backend (Physical Device on Same Wi-Fi)
# EXPO_PUBLIC_API_URL=http://<YOUR_COMPUTER_LOCAL_IP>:5000
# EXPO_PUBLIC_SOCKET_URL=http://<YOUR_COMPUTER_LOCAL_IP>:5000
```

---

## 🔌 REST API & Socket.IO Reference

### Core REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend and database health verification |
| `GET` | `/socket-status` | Active WebSocket client telemetry |
| `POST` | `/api/auth/register` | Register new user with bike & emergency data |
| `POST` | `/api/auth/login` | Authenticate with email and password |
| `GET` | `/api/auth/profile/:userId` | Retrieve sanitized user profile |
| `POST` | `/api/rides` | Create a new group ride & generate 6-character code |
| `POST` | `/api/rides/join` | Join ride convoy using code |
| `GET` | `/api/rides/:rideCode` | Fetch complete ride details and member list |
| `PATCH` | `/api/rides/:rideCode/status` | Start (`isStarted: true`) or end ride |
| `PATCH` | `/api/rides/:rideCode/route` | Store planned route coordinates & waypoints |
| `POST` | `/api/rides/:rideCode/sos` | Broadcast emergency SOS distress signal |
| `GET` | `/api/rides/:rideCode/messages` | Retrieve in-ride message history |
| `POST` | `/api/rides/:rideCode/messages` | Send in-ride announcement/quick message |

### WebSocket Real-Time Events

| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `joinRide` | Client ➔ Server | `{ rideCode, userId, userName, role }` |
| `locationsSnapshot`| Server ➔ Client | Full snapshot of Captain and all rider coordinates |
| `updateLocation` | Client ➔ Server | `{ rideCode, latitude, longitude, updatedAt }` |
| `locationUpdated` | Server ➔ Room | Real-time broadcast of rider/captain position |
| `sosAlert` | Server ➔ Room | High-priority emergency broadcast |
| `ride:message:send`| Client ➔ Server | `{ rideCode, messageText, messageType }` |
| `ride:message:new` | Server ➔ Room | Convoy message broadcast |
| `userJoined` | Server ➔ Room | Notification when a new member joins |
| `userLeft` | Server ➔ Room | Notification when a member leaves |

---

## 🧪 Testing & Validation

The RYDO codebase maintains automated verification scripts:

### Backend Testing

```bash
cd backend
npm test
```
* Runs the built-in Node.js test runner against `tests/integration.test.js`.
* Validates health, registration, login, ride generation, joining, status toggle, SOS, and messaging.

### Frontend Validation

```bash
cd mobile
npx expo-doctor       # 20/20 checks passed
npx tsc --noEmit      # Strict TypeScript check (0 errors)
npm run lint          # ESLint flat config validation
npx expo export --platform web # Verifies bundler static compilation
```

---

## 🚢 Production Deployment

### Backend Deployment (e.g., Render / Railway / AWS EC2)
1. Set Environment Variables: `MONGODB_URI`, `PORT=5000`.
2. Set Build Command: `npm install`.
3. Set Start Command: `npm start`.
4. Ensure outbound WebSocket traffic is permitted on port 443 / 5000.

### Mobile Standalone Builds (EAS Build)
1. Install EAS CLI: `npm install -g eas-cli`.
2. Configure credentials: `eas login`.
3. Build for Android APK / AAB:
   ```bash
   cd mobile
   eas build --platform android --profile preview
   ```

---

## 🛡️ Security Guidelines

* **Password Security:** Salted PBKDF2 with 10,000 iterations and SHA-512.
* **Timing-Safe Comparison:** `crypto.timingSafeEqual` prevents timing attack vulnerabilities on password validation.
* **Sensitive Data Redaction:** Model method `toSafeObject()` strips `passwordHash` and `passwordSalt` before client transmission.
* **Environment Isolation:** `.env` files are strictly ignored by `.gitignore`.

---

## 👥 Contributors

Developed with dedication by the **RYDO Team** for road safety and convoy coordination.
