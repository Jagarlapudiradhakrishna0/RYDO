# RYDO — Environment Variables Reference

This document provides a comprehensive description of all environment variables across the RYDO platform.

> **Security Note:** Never commit actual `.env` files with production credentials to GitHub. Always use secrets management in CI/CD and deployment platforms.

---

## 1. Backend Environment Variables (`backend/.env`)

| Variable Name | Required | Default Value | Description |
|:---|:---:|:---|:---|
| `PORT` | Optional | `5000` | Port on which the Express REST API and Socket.IO server listen. |
| `MONGODB_URI` | **Yes** | *None* | Connection string for MongoDB (Local or MongoDB Atlas).<br>Example: `mongodb+srv://user:pass@cluster.mongodb.net/rydo?retryWrites=true&w=majority` |
| `JWT_SECRET` | Recommended | `rydo_secret_jwt_key` | Cryptographic secret key used to sign and verify user authentication tokens. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development`, `production`, or `test`). In `production`, detailed error traces are suppressed. |

### Example `backend/.env`
```env
PORT=5000
MONGODB_URI=mongodb+srv://developer:SecurePass123@cluster0.mongodb.net/rydo?retryWrites=true&w=majority
JWT_SECRET=super_secure_rydo_production_jwt_signing_key_32_chars
NODE_ENV=development
```

---

## 2. Mobile Environment Variables (`mobile/.env`)

Expo automatically inlines variables prefixed with `EXPO_PUBLIC_` at build/bundle time.

| Variable Name | Required | Default Fallback | Description |
|:---|:---:|:---|:---|
| `EXPO_PUBLIC_API_URL` | **Yes** | `https://rydo-irav.onrender.com` | Base URL for all REST API HTTP calls (`Axios`). |
| `EXPO_PUBLIC_SOCKET_URL` | **Yes** | `https://rydo-irav.onrender.com` | Host URL for real-time WebSocket communication (`Socket.IO`). |

### Configuration Scenarios for Mobile

#### Scenario 1: Development on Android Studio Emulator
When the backend runs locally on your development machine, the Android Emulator accesses host `localhost` via the loopback bridge `10.0.2.2`:
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

#### Scenario 2: Development on Physical Phone (Expo Go)
When running Expo Go on a physical phone connected to the same Wi-Fi network as your PC:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:5000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.100:5000
```
*(Replace `192.168.1.100` with your machine's local IP address).*

#### Scenario 3: Cloud Staging / Production Backend
When connecting to the deployed cloud instance:
```env
EXPO_PUBLIC_API_URL=https://rydo-irav.onrender.com
EXPO_PUBLIC_SOCKET_URL=https://rydo-irav.onrender.com
```

---

## 3. Environment Template Files

The repository provides ready-to-use template files:
- `backend/.env.example`
- `mobile/.env.example`
- `.env.example` (Root pointer)

To initialize, copy each file without the `.example` extension:
```bash
# Windows
Copy-Item backend\.env.example backend\.env
Copy-Item mobile\.env.example mobile\.env

# macOS / Linux
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
```

