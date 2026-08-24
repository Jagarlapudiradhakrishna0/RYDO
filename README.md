# RYDO 🏍️💨

**RYDO** is a real-time group ride coordination mobile application built for motorcycling convoys, cycling clubs, and group travel. It enables ride captains and riders to synchronize live GPS locations, manage routes, stay together on the road, and instantly signal emergency SOS alerts.

---

## 🚀 Key Features

* **Captain Mode:** Create rides, generate 6-character ride codes, start/end rides, manage convoy participants, and calculate navigation routes with OSRM.
* **Rider Mode:** Join active group rides with a single ride code, view the entire convoy on an interactive live map, and stay in sync with the captain.
* **Live GPS Tracking:** High-frequency bi-directional location broadcasting powered by Socket.IO rooms.
* **Interactive Route Planning:** Turn-by-turn route calculation and map polylines using Open Source Routing Machine (OSRM) and `react-native-maps`.
* **SOS Emergency Alert System:** Instant one-tap distress button that broadcasts emergency alerts with exact GPS coordinates to all ride members.
* **User Profiles & Safety Details:** Blood group, emergency contact phone, bike registration number, and consent tracking.
* **Secure Authentication:** User registration and login protected with PBKDF2 salt-based password hashing.
* **REST API & MongoDB:** Scalable backend with Mongoose schemas for rides, riders, routes, and alerts.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Mobile App** | React Native, Expo SDK 54, Expo Router (file-based), TypeScript |
| **Maps & Location** | `react-native-maps`, `expo-location`, Project OSRM Routing API |
| **Real-Time Layer** | Socket.IO Client & Socket.IO Server (`v4.8.x`) |
| **Backend Server** | Node.js, Express 5.2.1 |
| **Database** | MongoDB & Mongoose 9.9.2 |
| **Security** | Node.js `crypto` (`pbkdf2Sync`, `timingSafeEqual`), CORS |

---

## 📂 Repository Structure

```
RYDO/
├── backend/                  # Express REST API & Socket.IO Server
│   ├── models/               # MongoDB models (User.js, Ride.js)
│   ├── routes/               # API endpoints (authRoutes.js, rideRoutes.js)
│   ├── socket/               # Real-time WebSocket handlers (rideSocket.js)
│   ├── .env.example          # Environment variable template
│   ├── package.json          # Backend dependencies and scripts
│   └── server.js             # HTTP & Socket.IO entry point
├── mobile/                   # React Native (Expo) Mobile App
│   ├── app/                  # Expo Router screens (login, register, dashboards, map)
│   ├── components/           # UI components
│   ├── constants/            # Network configs (network.ts), auth state, theme
│   ├── .env.example          # Mobile environment template
│   ├── app.json              # Expo configuration
│   └── package.json          # Mobile dependencies and scripts
├── README.md                 # Project summary and overview (this file)
└── TEAM_SETUP.md             # Detailed step-by-step setup guide for team members
```

---

## ⚡ Quick Start for New Team Members

> 📖 **Looking for full step-by-step installation instructions?**  
> Please read the complete **[TEAM_SETUP.md](./TEAM_SETUP.md)** guide.

### 1. Clone the Repository
```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd RYDO
```

### 2. Configure Backend
```bash
cd backend
npm install
# Copy .env.example to .env and set MONGODB_URI
npm start
```
*Backend runs at `http://localhost:5000` (Health check: `http://localhost:5000/api/health`)*

### 3. Configure Mobile App
```bash
cd ../mobile
npm install
# Copy .env.example to .env
npx expo start -c
```
*Scan the QR code with **Expo Go** (Android) or press `a` for the Android Emulator.*

---

## 🌐 Backend URL Configuration

RYDO supports both public production and local development backends:

* **Production Backend (Default):** `https://rydo-irav.onrender.com`  
  *(Recommended for physical phone testing with Expo Go across any network)*
* **Local Backend (Emulator):** `http://10.0.2.2:5000`  
* **Local Backend (Physical Phone on same Wi-Fi):** `http://<YOUR_LAN_IP>:5000`

Configure your backend URL in `mobile/.env`.

---

## 🔌 API & Socket.IO Overview

* **Health Check:** `GET /api/health`
* **Socket Status:** `GET /socket-status`
* **Authentication:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/profile/:userId`
* **Rides:** `POST /api/rides` (Create), `POST /api/rides/join` (Join), `GET /api/rides/:code` (Details)
* **Status & Route:** `PATCH /api/rides/:code/status`, `PATCH /api/rides/:code/route`
* **Locations:** `PATCH /api/rides/:code/captain-location`, `PATCH /api/rides/:code/riders/:id/location`, `GET /api/rides/:code/locations`
* **Emergency:** `POST /api/rides/:code/sos`
* **Socket.IO Events:** `joinRide`, `updateLocation`, `locationUpdated`, `userJoined`, `leaveRide`, `userLeft`

For full API payloads and error handling, see [TEAM_SETUP.md](./TEAM_SETUP.md#17-complete-rest-api-reference).

---

## 🔒 Security & Git Rules

* **NEVER commit `.env` files, database passwords, or secret keys to GitHub.**
* Always create a feature branch (`git checkout -b feature/your-feature`) and submit a Pull Request.
* Keep dependencies local — never remove `node_modules` from `.gitignore`.

---

## 👥 Contributors

Developed as a group project by the RYDO Team.
