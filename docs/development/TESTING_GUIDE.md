# RYDO — Testing & Quality Assurance Guide

Comprehensive guide to executing backend integration tests and frontend mobile validation checks.

---

## 1. Automated Backend Test Suite

The backend test suite is powered by Node.js's native test runner (`node --test`), requiring zero external dependencies or heavy harnesses.

### Running Backend Tests

```bash
# Navigate to the backend directory
cd backend

# Execute automated tests
npm test
```

### What the Test Suite Validates

| Test Case | Method & Endpoint | Verification Criteria |
| :--- | :--- | :--- |
| **Health Check** | `GET /api/health` | HTTP 200, `success: true` |
| **System Status** | `GET /` | HTTP 200, `status: 'online'` |
| **Socket Telemetry** | `GET /socket-status` | HTTP 200, reports connected client count |
| **User Registration** | `POST /api/auth/register` | HTTP 201, valid password salting, returns user |
| **User Login** | `POST /api/auth/login` | HTTP 200, constant-time password verification |
| **Ride Creation** | `POST /api/rides` | HTTP 201, generates unique 6-character ride code |
| **Ride Retrieval** | `GET /api/rides/:code` | HTTP 200, retrieves full ride document |
| **Convoy Joining** | `POST /api/rides/join` | HTTP 200, adds rider to convoy riders list |
| **Convoy Departure** | `PATCH /api/rides/:code/status` | HTTP 200, sets `isStarted: true`, `status: 'live'` |
| **Emergency SOS** | `POST /api/rides/:code/sos` | HTTP 200, registers emergency distress beacon |
| **In-Ride Messaging** | `POST /api/rides/:code/messages` | HTTP 201, records message with timestamp |
| **Message History** | `GET /api/rides/:code/messages` | HTTP 200, retrieves chronological message array |
| **Ride Completion** | `PATCH /api/rides/:code/status` | HTTP 200, sets `isStarted: false`, `status: 'ended'` |

---

## 2. Frontend Validation Checks

The mobile application utilizes Expo SDK 58, React Native 0.88, and TypeScript 6.0.3.

### 2.1 Dependency & Compatibility Health Check
```bash
cd mobile
npx expo-doctor
```
* **Success Criteria:** 20/20 checks passed with zero errors or version mismatches.

### 2.2 Strict TypeScript Compilation
```bash
cd mobile
npx tsc --noEmit
```
* **Success Criteria:** Zero type errors (`TS2769`, `TS2339`, etc.) across all screens and components.

### 2.3 ESLint Flat Config Linting
```bash
cd mobile
npm run lint
```
* **Success Criteria:** 0 errors reported under `eslint-config-expo/flat`.

### 2.4 Bundler Static Export Compilation
```bash
cd mobile
npx expo export --platform web
```
* **Success Criteria:** Bundles all 16 static routes without SSR runtime failures or undefined window references.

---

## 3. End-to-End Manual Workflow Validation

### Captain Flow:
1. Register/Login as Captain (`Alex Johnson`).
2. Navigate to **Captain Mode** -> **Create Ride**.
3. Confirm generation of the 6-character ride code (e.g. `H7X9QK`).
4. Click **Start Ride** -> Verify status changes to `LIVE`.
5. Open **Live Ride Map** -> Verify your location marker appears with a blue halo.

### Rider Flow:
1. Register/Login as Rider (`Rahul Sharma`) on a second device/tab.
2. Select **Rider Mode** -> Enter the 6-character ride code.
3. Verify you appear in the Captain's Convoy Crew member list.
4. Press the **SOS** distress button -> Confirm immediate red pulsing alert overlay across both devices.
5. Send a quick voice broadcast ("Need fuel") -> Verify message arrives and is read aloud by Text-To-Speech.

