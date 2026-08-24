# RYDO — Complete Team Setup & Developer Guide

Welcome to the **RYDO** project! This guide contains the complete, step-by-step instructions for getting your local development environment up and running smoothly.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites & System Requirements](#2-prerequisites--system-requirements)
3. [Clone & Repository Setup](#3-clone--repository-setup)
4. [Project Structure](#4-project-structure)
5. [Understanding `node_modules` and Dependencies](#5-understanding-node_modules-and-dependencies)
6. [Backend Setup & Configuration](#6-backend-setup--configuration)
7. [Troubleshooting Port 5000 (`EADDRINUSE`)](#7-troubleshooting-port-5000-eaddrinuse)
8. [Mobile App (Expo) Setup](#8-mobile-app-expo-setup)
9. [Local vs. Production Backend Configuration](#9-local-vs-production-backend-configuration)
10. [Running the Mobile App (Emulator & Physical Device)](#10-running-the-mobile-app-emulator--physical-device)
11. [First-Time Setup — Quick Checklist](#11-first-time-setup--quick-checklist)
12. [Daily Development Workflow](#12-daily-development-workflow)
13. [Git Collaboration & Branching Strategy](#13-git-collaboration--branching-strategy)
14. [Security Guidelines & Ignored Files](#14-security-guidelines--ignored-files)
15. [Database (MongoDB) Architecture](#15-database-mongodb-architecture)
16. [Socket.IO Real-Time Architecture](#16-socketio-real-time-architecture)
17. [Complete REST API Reference](#17-complete-rest-api-reference)
18. [Troubleshooting Guide](#18-troubleshooting-guide)
19. [Setup Verification Checklist](#19-setup-verification-checklist)

---

## 1. Project Overview

**RYDO** is a real-time group ride coordination mobile application designed for motorcycling groups, cycling clubs, and convoy travel.

### Key Features Implemented:
* **Captain Mode:** Create rides, generate unique 6-character ride codes, start/end rides, manage members, plan routes via OSRM, and broadcast GPS coordinates.
* **Rider Mode:** Join active rides using a ride code, view captain and rider positions in real-time, leave rides, and trigger emergency alerts.
* **Live GPS Tracking:** High-frequency bi-directional location broadcasting using Socket.IO rooms.
* **Interactive Maps & Route Planning:** Route calculation and polyline rendering powered by Open Source Routing Machine (OSRM) and `react-native-maps`.
* **SOS Emergency Alert System:** Instant one-tap distress signal with GPS coordinates broadcasted to all ride members.
* **Emergency Contacts & User Profiles:** Blood group, emergency contact name/phone, bike registration number, and consent management.
* **Authentication:** Secure registration and login with salt-based password hashing (`pbkdf2Sync`).
* **Cross-Platform Support:** Built on React Native and Expo SDK 54 with Expo Router.

---

## 2. Prerequisites & System Requirements

Before starting, make sure the following software is installed on your machine:

### Required Software:
1. **Git:** Distributed version control ([Download Git](https://git-scm.com/))
2. **Node.js:** JavaScript runtime environment ([Download Node.js](https://nodejs.org/))
   * *Recommendation:* Node.js LTS version (v18.x or v20.x recommended, compatible with v22+).
3. **npm:** Node Package Manager (comes bundled with Node.js).
4. **VS Code:** Recommended code editor ([Download VS Code](https://code.visualstudio.com/)).

### Mobile Testing Options:
* **Option A (Physical Device - Recommended):** Install **Expo Go** from Google Play Store on your Android phone.
* **Option B (Android Emulator):** Install **Android Studio**, Android SDK, and configure an Android Virtual Device (AVD).

### Verifying Tool Installations:
Open your terminal (PowerShell, Command Prompt, or Bash) and run:

```bash
node --version
npm --version
git --version
```

If any command returns `'command not found'` or an error, re-install the software and make sure it is added to your system's `PATH`.

---

## 3. Clone & Repository Setup

Every team member must work from their own local clone of the repository.

### Step 1: Clone the Repository
```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd RYDO
```

### Git Concepts for Team Members:
* `git clone`: Downloads the full project repository from GitHub to your computer for the first time.
* `git pull origin main`: Fetches and integrates the latest changes from the remote `main` branch into your local branch.
* `git push`: Uploads your committed local branch changes to GitHub.

Always ensure your branch is up to date before starting work:
```bash
git pull origin main
```

---

## 4. Project Structure

```
RYDO/
├── backend/                  # Node.js & Express API Server with Socket.IO
│   ├── models/               # Mongoose schemas (User.js, Ride.js)
│   ├── routes/               # API route handlers (authRoutes.js, rideRoutes.js)
│   ├── socket/               # Real-time WebSocket handlers (rideSocket.js)
│   ├── .env.example          # Environment variable template for backend
│   ├── package.json          # Backend dependencies and scripts
│   └── server.js             # HTTP server, MongoDB connection, Socket.IO init
├── mobile/                   # React Native mobile application (Expo SDK 54)
│   ├── app/                  # Expo Router file-based screens & navigation
│   │   ├── index.tsx         # Welcome / Authentication router
│   │   ├── login.tsx         # User login screen
│   │   ├── register.tsx      # User registration with emergency details
│   │   ├── ride-choice.tsx   # Captain vs. Rider mode selector
│   │   ├── create-ride.tsx   # Ride creation screen (Captain)
│   │   ├── ride-created.tsx  # Ride code display & share screen
│   │   ├── join-ride.tsx     # Enter ride code screen (Rider)
│   │   ├── captain-dashboard.tsx # Captain control center
│   │   ├── rider-dashboard.tsx   # Rider dashboard
│   │   ├── route-planner.tsx     # Destination search & OSRM routing
│   │   └── live-ride-map.tsx     # Real-time GPS map screen
│   ├── components/           # Reusable UI components
│   ├── constants/            # Network configs (network.ts), auth store, theme
│   ├── hooks/                # Custom React hooks (theme, colors)
│   ├── .env.example          # Environment variable template for mobile
│   ├── app.json              # Expo configuration and permissions
│   ├── package.json          # Mobile dependencies and scripts
│   └── tsconfig.json         # TypeScript configuration
├── .gitignore                # Git ignore rules for root, backend, and mobile
├── README.md                 # Project summary and overview
└── TEAM_SETUP.md             # This comprehensive setup guide
```

---

## 5. Understanding `node_modules` and Dependencies

* **`package.json`** lists the exact packages and versions the application depends on.
* **`package-lock.json`** locks the exact dependency tree to ensure all team members get identical builds.
* **`node_modules/`** is the generated folder where npm downloads libraries. It is intentionally ignored by Git and **must never be committed**.
* **Each folder (`backend/` and `mobile/`) has its own `package.json`** and requires its own separate `npm install`.

---

## 6. Backend Setup & Configuration

### Step 1: Navigate to the Backend Directory
```bash
cd backend
```

### Step 2: Install Backend Dependencies
```bash
npm install
```

### Step 3: Configure Backend Environment Variables
1. Copy the `.env.example` file to create your own `.env`:
   * **Windows (PowerShell):**
     ```powershell
     Copy-Item .env.example .env
     ```
   * **macOS / Linux / Git Bash:**
     ```bash
     cp .env.example .env
     ```
2. Open `backend/.env` in VS Code and fill in the values:
   ```env
   MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
   PORT=5000
   ```
   > **Note:** Obtain the MongoDB connection string from your team lead or set up a free MongoDB Atlas cluster (see [Database Setup](#15-database-mongodb-architecture)).

### Step 4: Start the Backend Server
```bash
npm start
```
*(Runs `node server.js`)*

### Step 5: Verify Backend Health
Open your browser or run in another terminal:
* **Health check:** `http://localhost:5000/api/health`
  * Expected response: `{"success":true,"message":"RYDO backend is running"}`
* **Socket status:** `http://localhost:5000/socket-status`
  * Expected response: `{"success":true,"message":"RYDO Socket.IO server is running","connectedClients":0}`

---

## 7. Troubleshooting Port 5000 (`EADDRINUSE`)

If you see this error when starting the backend:
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5000
```
This means another process is already listening on port `5000` (often a previously running backend instance).

### Fix on Windows:
1. **Find the Process ID (PID) using port 5000:**
   ```powershell
   netstat -ano | findstr :5000
   ```
   *Look at the last column in the output to find the numerical `<PID>` (e.g., `12345`).*

2. **Identify what program is running on that PID:**
   ```powershell
   tasklist | findstr <PID>
   ```

3. **Terminate the hanging process:**
   ```powershell
   taskkill /PID <PID> /F
   ```

4. **Restart the server:**
   ```powershell
   npm start
   ```

> **Warning:** Do not arbitrarily change the `PORT` in `.env` without updating the mobile configuration, because the app expects the backend on port 5000 for local development.

---

## 8. Mobile App (Expo) Setup

### Step 1: Open a New Terminal and Navigate to Mobile Directory
```bash
cd mobile
```

### Step 2: Install Mobile Dependencies
```bash
npm install
```

### Step 3: Configure Mobile Environment Variables
1. Copy `.env.example` to `.env`:
   * **Windows (PowerShell):**
     ```powershell
     Copy-Item .env.example .env
     ```
   * **macOS / Linux / Git Bash:**
     ```bash
     cp .env.example .env
     ```
2. Open `mobile/.env` and verify the settings:
   ```env
   EXPO_PUBLIC_API_URL=https://rydo-irav.onrender.com
   EXPO_PUBLIC_SOCKET_URL=https://rydo-irav.onrender.com
   ```

### Step 4: Start the Expo Development Server
```bash
npx expo start -c
```
* **Why `-c`?** The `-c` flag clears Metro bundler cache, preventing stale module errors and ensuring fresh environment variable reads.

---

## 9. Local vs. Production Backend Configuration

RYDO supports two backend environments:

| Mode | Mobile `.env` Setting | Best For |
| :--- | :--- | :--- |
| **Public Production (Default)** | `EXPO_PUBLIC_API_URL=https://rydo-irav.onrender.com`<br>`EXPO_PUBLIC_SOCKET_URL=https://rydo-irav.onrender.com` | Testing on physical devices across different Wi-Fi/cellular networks. **No local backend server required.** |
| **Local Development (Emulator)** | `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000`<br>`EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000` | Testing backend code modifications directly in the Android Studio Emulator. |
| **Local Development (Physical Device)** | `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:5000`<br>`EXPO_PUBLIC_SOCKET_URL=http://<YOUR_LAN_IP>:5000` | Testing local backend changes on a physical phone connected to the **same Wi-Fi router**. |

### Finding Your Local LAN IP (for Local Physical Phone testing):
* **Windows:** Run `ipconfig` and look for the `IPv4 Address` under your active Wi-Fi adapter (e.g., `192.168.1.45`).
* **macOS / Linux:** Run `ifconfig` or `ip a`.

---

## 10. Running the Mobile App (Emulator & Physical Device)

### Option A: Physical Android Phone with Expo Go (Recommended)
1. Install **Expo Go** from the Google Play Store on your Android phone.
2. Run `npx expo start -c` inside the `mobile/` directory.
3. Open the **Expo Go** app on your phone.
4. Scan the QR code displayed in your terminal.
5. The RYDO app bundle will download and launch on your phone.

### Option B: Android Studio Emulator
1. Install **Android Studio** and ensure the Android SDK and command-line tools are installed.
2. In Android Studio, open **Virtual Device Manager** and launch an Android Virtual Device (AVD).
3. In your `mobile/` terminal, start Expo:
   ```bash
   npx expo start -c
   ```
4. Press `a` in the terminal to automatically build and open the app in the running Android emulator.

---

## 11. First-Time Setup — Quick Checklist

Use this 12-step checklist to complete your initial onboarding:

1. [ ] Install **Git**, **Node.js** (LTS), and **VS Code**.
2. [ ] Clone the repository: `git clone YOUR_GITHUB_REPOSITORY_URL`.
3. [ ] Open the `RYDO` folder in VS Code.
4. [ ] In `backend/`, copy `.env.example` to `.env` and add the `MONGODB_URI`.
5. [ ] Run `cd backend && npm install`.
6. [ ] In `mobile/`, copy `.env.example` to `.env`.
7. [ ] Run `cd mobile && npm install`.
8. [ ] Start the backend in Terminal 1: `cd backend && npm start`.
9. [ ] Verify backend is healthy at `http://localhost:5000/api/health`.
10. [ ] Start Expo in Terminal 2: `cd mobile && npx expo start -c`.
11. [ ] Scan QR code with **Expo Go** or press `a` for Android Emulator.
12. [ ] Test registration, login, ride creation, and ride joining.

---

## 12. Daily Development Workflow

Once your environment is set up, daily development requires only two terminal tabs:

### Terminal 1 (Backend Server)
```bash
cd backend
npm start
```

### Terminal 2 (Mobile Bundler)
```bash
cd mobile
npx expo start -c
```

> **Tip:** Do not start multiple backend processes. If you restart the server, make sure the previous terminal session is stopped (`Ctrl + C`).

---

## 13. Git Collaboration & Branching Strategy

To prevent merge conflicts and overwriting teammates' work, follow this branch-based workflow:

### Step 1: Pull Latest Main
```bash
git checkout main
git pull origin main
```

### Step 2: Create a Feature Branch
Use descriptive branch names:
```bash
git checkout -b feature/login-ui
# Other examples:
# git checkout -b feature/captain-controls
# git checkout -b feature/sos-alert
# git checkout -b fix/auth-token
```

### Step 3: Make and Commit Changes
```bash
git add .
git commit -m "feat: implement emergency contact form validation"
```

### Step 4: Push to GitHub and Open a Pull Request (PR)
```bash
git push -u origin feature/login-ui
```
Go to the GitHub repository and create a Pull Request against `main`. Have at least one team member review before merging.

---

## 14. Security Guidelines & Ignored Files

### Critical Security Rule:
**NEVER commit passwords, database connection strings, JWT secrets, or private keys to GitHub.**

### Git Ignored Files in RYDO:
* `node_modules/` (heavy library dependencies)
* `.env` & `.env.*` (secret credentials)
* `npm-debug.log*` / `yarn-error.log*` (log files)
* `.expo/` & `dist/` (build artifacts)

### What to do if a secret is accidentally committed:
1. Immediately notify the team lead.
2. Invalidate/rotate the database password or API key immediately in MongoDB Atlas / hosting dashboard.
3. Remove the sensitive commit before pushing to remote.

---

## 15. Database (MongoDB) Architecture

RYDO uses **MongoDB** managed through **Mongoose ODM**.

* **Connection String:** Configured via `MONGODB_URI` in `backend/.env`.
* **Connection Handling:** In `backend/server.js`, Mongoose connects asynchronously on server start.
* **Database Models:**
  1. **User Model (`backend/models/User.js`):**
     * `name` (String, required)
     * `phoneNumber` (String, required, unique)
     * `bikeNumber` (String, required)
     * `email` (String, required, unique)
     * `bloodGroup` (String, enum: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`)
     * `nativePlace` (String)
     * `emergencyContact` (`{ name: String, phoneNumber: String }`)
     * `emergencyContactConsent` (Boolean)
     * `passwordSalt` & `passwordHash` (Secure PBKDF2 hash)
  2. **Ride Model (`backend/models/Ride.js`):**
     * `rideCode` (String, unique 6-character code e.g. `ABC123`)
     * `rideName` (String)
     * `captainName` (String)
     * `isStarted` (Boolean)
     * `status` (String: `'created'`, `'live'`, `'ended'`)
     * `captainLocation` (`{ latitude: Number, longitude: Number, updatedAt: Date }`)
     * `riders` (Array of `{ name, location: { latitude, longitude, updatedAt } }`)
     * `route` (`{ destinationName, destinationCoordinates, waypoints, geometry }`)
     * `sosAlerts` (Array of `{ riderName, latitude, longitude, timestamp, resolved }`)

---

## 16. Socket.IO Real-Time Architecture

RYDO uses **Socket.IO** (`v4.8.x`) for instant bi-directional coordination between the Captain and Riders.

### Socket Room Isolation:
Each ride acts as an independent Socket.IO room named after the `rideCode`.

### Events Reference:

#### Client-to-Server Events:
| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `joinRide` | `{ rideCode, memberId, userName, role }` | Joins the specific ride's Socket room |
| `updateLocation` | `{ rideCode, memberId, userName, role, latitude, longitude, updatedAt }` | Emits current GPS coordinates |
| `getSocketInfo` | `{}` | Requests current socket room and identity |
| `leaveRide` | `{}` | Gracefully leaves the ride room |

#### Server-to-Client Events:
| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `rideJoined` | `{ success, rideCode, memberId, userName, role }` | Confirms successful socket room join |
| `userJoined` | `{ memberId, userName, role, rideCode }` | Broadcasts to room that a new rider/captain joined |
| `locationUpdated` | `{ memberId, rideCode, userName, role, latitude, longitude, updatedAt }` | Broadcasts live coordinates to all room members |
| `userLeft` | `{ memberId, userName, role, rideCode }` | Broadcasts when a member leaves |
| `userDisconnected`| `{ memberId, userName, role, rideCode }` | Broadcasts when a socket disconnects |
| `socketError` | `{ message }` | Sends validation or runtime error notice |

---

## 17. Complete REST API Reference

All backend API routes are prefixed with `/api`.

### Base & Diagnostic Endpoints:
* `GET /` — Server status root endpoint.
* `GET /api/health` — API health check probe.
* `GET /socket-status` — Active Socket.IO client count.
* `GET /api/auth/test` — Auth route verification endpoint.

### Authentication Endpoints (`/api/auth`):
* `POST /api/auth/register` — Register a new rider/captain.
  * **Body:** `{ name, phoneNumber, bikeNumber, email, bloodGroup, nativePlace, emergencyContactName, emergencyContactPhone, password, confirmPassword, emergencyContactConsent }`
* `POST /api/auth/login` — Authenticate user and retrieve profile.
  * **Body:** `{ email, password }`
* `GET /api/auth/profile/:userId` — Retrieve user profile by MongoDB ObjectId.

### Ride Management Endpoints (`/api/rides`):
* `POST /api/rides` — Create a new ride (generates a unique 6-character code).
  * **Body:** `{ rideName, captainName }`
* `POST /api/rides/join` — Join an existing ride.
  * **Body:** `{ rideCode, riderName }`
* `GET /api/rides/:rideCode` — Retrieve full ride state, riders, route, and status.
* `PATCH /api/rides/:rideCode/status` — Start or end a ride.
  * **Body:** `{ isStarted: true | false }`
* `PATCH /api/rides/:rideCode/route` — Set or update destination and OSRM route geometry.
  * **Body:** `{ destinationName, destinationCoordinates: [lng, lat], waypoints, geometry }`
* `PATCH /api/rides/:rideCode/captain-location` — Update captain's GPS position in database.
  * **Body:** `{ latitude, longitude }`
* `PATCH /api/rides/:rideCode/riders/:riderId/location` — Update rider's GPS position in database.
  * **Body:** `{ latitude, longitude }`
* `GET /api/rides/:rideCode/locations` — Retrieve all active GPS locations for captain and riders.
* `POST /api/rides/:rideCode/leave` — Rider leaves a ride.
  * **Body:** `{ riderName }`
* `DELETE /api/rides/:rideCode/riders/:riderId` — Captain removes a rider from the ride.
* `POST /api/rides/:rideCode/sos` — Trigger SOS distress alert with coordinates.
  * **Body:** `{ riderName, latitude, longitude, userId, riderId }`

---

## 18. Troubleshooting Guide

### Issue A: `npm install` fails
* **Cause:** Incompatible Node version or conflicting global cache.
* **Diagnostic:** Run `node -v` and `npm -v`.
* **Fix:** Clear cache with `npm cache clean --force` and delete `node_modules` + `package-lock.json`, then run `npm install`.

### Issue B: `'node'` or `'npm'` command not found
* **Cause:** Node.js is not installed or missing from the system environment variable `PATH`.
* **Fix:** Reinstall Node.js from [nodejs.org](https://nodejs.org) and check "Add to PATH" during installation. Restart terminal.

### Issue C: `Port 5000 is already in use (EADDRINUSE)`
* **Cause:** A previous backend process is still running in the background.
* **Diagnostic:** Run `netstat -ano | findstr :5000`.
* **Fix:** Kill the PID using `taskkill /PID <PID> /F` (Windows) or `lsof -ti:5000 | xargs kill -9` (macOS/Linux).

### Issue D: Expo does not start or bundler hangs
* **Cause:** Stale Metro bundler cache.
* **Fix:** Start with the clean cache flag: `npx expo start -c`.

### Issue E: Android emulator not detected
* **Cause:** Android Studio ADB is not running or no virtual device is active.
* **Fix:** Open Android Studio > Device Manager > Start an AVD. Verify with `adb devices`.

### Issue F: Expo Go on physical phone cannot connect to Metro
* **Cause:** Computer and phone are on different Wi-Fi networks, or Windows Firewall is blocking port 8081.
* **Fix:** Connect both devices to the same 2.4/5GHz Wi-Fi network and allow Node.js through Windows Defender Firewall.

### Issue G: API requests fail / Network Error in Mobile App
* **Cause:** `EXPO_PUBLIC_API_URL` is pointing to `localhost` on a physical device.
* **Fix:** On a physical phone, use the public production backend `https://rydo-irav.onrender.com` or your computer's LAN IP (e.g., `http://192.168.1.X:5000`).

### Issue H: MongoDB connection fails (`RYDO: MongoDB connection failed`)
* **Cause:** IP address not whitelisted in MongoDB Atlas or invalid `MONGODB_URI`.
* **Fix:** In MongoDB Atlas > Network Access, add your current IP address (or `0.0.0.0/0` for development). Verify credentials in `backend/.env`.

### Issue I: Missing environment variables (`MONGODB_URI is not configured in .env`)
* **Cause:** `.env` was not created from `.env.example`.
* **Fix:** Create `.env` inside `backend/` and `mobile/` using the instructions in [Sections 6 & 8](#6-backend-setup--configuration).

### Issue J: Endpoint not found (`404`)
* **Cause:** Incorrect API route path or method.
* **Fix:** Double-check against the [API Reference](#17-complete-rest-api-reference) (all routes start with `/api`).

### Issue K: Socket.IO fails to connect
* **Cause:** `EXPO_PUBLIC_SOCKET_URL` does not match the running backend URL.
* **Fix:** In `mobile/.env`, verify `EXPO_PUBLIC_SOCKET_URL` matches `EXPO_PUBLIC_API_URL`.

---

## 19. Setup Verification Checklist

Once your setup is finished, run through these test actions:

1. **Backend Verification:**
   * Run `npm start` in `backend/`. Confirm console outputs `RYDO: MongoDB connected` and `Server running on port 5000`.
   * Visit `http://localhost:5000/api/health` in your browser and verify `{"success":true}`.

2. **Mobile App Verification:**
   * Run `npx expo start -c` in `mobile/`.
   * Open the app in Expo Go or Emulator.
   * Go to **Register** and create a test account.
   * Log in with your new credentials.

3. **Ride Coordination Verification:**
   * Select **Create Ride** (Captain mode) -> Enter a ride name -> Verify 6-character ride code is generated.
   * In a second device/emulator or with a teammate, select **Join Ride** (Rider mode) -> Enter the code -> Confirm successful join.
   * Open the **Live Map** -> Confirm GPS markers and real-time Socket communication.
   * Test the **SOS** button -> Verify alert broadcasts to all members in the ride.

Congratulations! Your RYDO development environment is fully operational.
