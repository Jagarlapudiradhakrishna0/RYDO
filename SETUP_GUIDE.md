# RYDO — Local & Team Setup Guide

This guide details step-by-step instructions to set up, configure, and run the complete RYDO platform (Mobile Frontend, Node.js Backend, and MongoDB Database) on your local development machine.

---

## 1. System Requirements

- **Operating System:** Windows 10/11, macOS 12+, or Ubuntu 20.04+
- **Node.js:** `v20.x` or `v22.x` (Check version: `node -v`)
- **npm:** `v10.x` or higher (Check version: `npm -v`)
- **Git:** Latest stable release (Check version: `git -v`)
- **Mobile Device or Emulator:**
  - Android Studio Emulator (Android 10+ / API 29+ recommended)
  - iOS Simulator (macOS with Xcode 15+)
  - Physical Android or iOS smartphone with **Expo Go** installed from the app store

---

## 2. Clone the Repository

```bash
git clone https://github.com/Jagarlapudiradhakrishna0/RYDO.git
cd RYDO
git checkout modernization-sdk-audit
```

---

## 3. Backend Setup

### Step 3.1: Install Dependencies
```bash
cd backend
npm install
```

### Step 3.2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell:
Copy-Item .env.example .env

# macOS / Linux:
cp .env.example .env
```

Open `backend/.env` and update:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/rydo?retryWrites=true&w=majority
PORT=5000
```
*(If running MongoDB locally via Docker or local service, set `MONGODB_URI=mongodb://127.0.0.1:27017/rydo`)*

### Step 3.3: Verify Backend Test Suite
```bash
npm test
```
*Expected: 13 tests passing with 0 failures.*

### Step 3.4: Start the Backend Server
```bash
npm start
```
*The server will start on `http://localhost:5000` and output:*
```
[RYDO Server] Server running on port 5000
[RYDO Server] MongoDB connected successfully
```

---

## 4. Mobile Frontend Setup

Open a second terminal window and navigate to the `mobile` directory.

### Step 4.1: Install Dependencies
```bash
cd mobile
npm install
```

### Step 4.2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell:
Copy-Item .env.example .env

# macOS / Linux:
cp .env.example .env
```

Open `mobile/.env` and configure according to your target testing device:

#### Scenario A: Using Local Backend on Android Emulator
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

#### Scenario B: Using Local Backend on Physical Device (Same Wi-Fi)
Find your computer's local LAN IP (e.g., `192.168.1.50` using `ipconfig` on Windows or `ifconfig` on Mac):
```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:5000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.50:5000
```

#### Scenario C: Using Cloud / Render Staging Backend
```env
EXPO_PUBLIC_API_URL=https://rydo-irav.onrender.com
EXPO_PUBLIC_SOCKET_URL=https://rydo-irav.onrender.com
```

### Step 4.3: Validate Mobile Project Health
```bash
npx expo-doctor
npx tsc --noEmit
```

### Step 4.4: Start the Expo Development Server
```bash
npx expo start -c
```

- Press `a` to open on an active Android Emulator.
- Press `w` to open the web version in your browser.
- Scan the terminal QR code using the **Expo Go** camera (Android) or default Camera app (iOS).

---

## 5. Troubleshooting Common Issues

### Issue 1: `Network request failed` on Android Device
- Ensure your physical phone and host computer are on the **exact same Wi-Fi subnet**.
- Ensure Windows Defender / firewall allows incoming connections on port `5000`.
- Use the host machine's LAN IP (`http://192.168.x.x:5000`) instead of `localhost`.

### Issue 2: Expo Cache Conflicts
If you encounter module resolution errors after pulling branch updates:
```bash
cd mobile
npx expo start -c
```
*(The `-c` flag flushes Metro bundler cache).*

### Issue 3: EADDRINUSE (Port 5000 occupied)
```powershell
# Windows:
Get-NetTCPConnection -LocalPort 5000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# macOS / Linux:
lsof -ti:5000 | xargs kill -9
```

