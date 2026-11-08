# RYDO — Production Deployment Guide

This guide covers deployment instructions for hosting the RYDO backend on cloud infrastructure (e.g. Render, Railway, AWS EC2, or DigitalOcean) and building standalone production binaries (APK/AAB/IPA) for the mobile client.

---

## 1. Backend Cloud Deployment

The RYDO backend is a stateless Node.js / Express / Socket.IO service backed by MongoDB.

### Recommended Providers
- **Render.com** (Native Web Service with WebSocket support)
- **Railway.app** (Automated Docker / Nixpacks deployment)
- **AWS ECS / DigitalOcean App Platform**

### Deployment Steps on Render

1. **Create a New Web Service:**
   - Connect your GitHub repository: `https://github.com/Jagarlapudiradhakrishna0/RYDO`.
   - Root Directory: `backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`

2. **Environment Variables:**
   Configure the following in the Render Dashboard:
   | Variable | Value Description |
   |:---|:---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (Render default) or custom |
   | `MONGODB_URI` | Your production MongoDB Atlas cluster URI |
   | `JWT_SECRET` | Strong cryptographic string (min 32 chars) |

3. **WebSocket Configuration:**
   - Render automatically supports persistent WebSocket connections on standard HTTP/HTTPS ports.
   - Sockets must use Sticky Sessions if scaled beyond a single instance (or utilize `@socket.io/redis-adapter`).

4. **Health Check Verification:**
   - Health check path: `/api/health`
   - Test command:
     ```bash
     curl https://your-backend-app.onrender.com/api/health
     ```
   - Expected JSON response:
     ```json
     {
       "status": "healthy",
       "service": "RYDO Backend",
       "timestamp": "2026-03-08T...",
       "uptime": 12.34
     }
     ```

---

## 2. Database Deployment (MongoDB Atlas)

1. **Deploy Cluster:** Provision a dedicated or M0/M10 MongoDB Atlas cluster in your target region.
2. **Network Security:**
   - Whitelist your backend server IP addresses (or `0.0.0.0/0` with secure user/password if using dynamic IP PaaS).
3. **Database User:**
   - Create a dedicated user with `readWrite` permissions on database `rydo`.
4. **Indexes:**
   - The application automatically verifies indexes on startup:
     - `User.phoneNumber` (unique)
     - `Ride.rideCode` (unique)
     - `Ride.captainId`

---

## 3. Mobile Production Build (Expo EAS)

RYDO is configured with Expo SDK 58 and Expo Router.

### Prerequisites
- Install EAS CLI: `npm install -g eas-cli`
- Authenticate with Expo: `eas login`

### Initialize EAS Project
Navigate to the mobile directory:
```bash
cd mobile
eas init
```

### Build Android Standalone APK (for Direct Distribution / Testing)
```bash
eas build --platform android --profile preview
```
*This produces a direct `.apk` file that can be downloaded and installed on any physical Android smartphone without requiring Expo Go.*

### Build Android App Bundle (for Google Play Store)
```bash
eas build --platform android --profile production
```
*This produces a signed `.aab` file ready for upload to Google Play Console.*

### Build iOS IPA (for Apple TestFlight / App Store)
```bash
eas build --platform ios --profile production
```
*(Requires an active Apple Developer Program membership).*

---

## 4. Mobile Environment Configuration for Production

When building for production, set the remote backend URL in `mobile/.env.production` or through EAS Secrets:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://your-backend-domain.com
eas secret:create --name EXPO_PUBLIC_SOCKET_URL --value https://your-backend-domain.com
```

---

## 5. Security & Maintenance Checklist

- [ ] Disable all development loggers (`console.log`) in high-frequency socket listeners before production compilation.
- [ ] Ensure MongoDB Atlas connection URI uses TLS (`retryWrites=true&w=majority`).
- [ ] Enforce HTTPS across all mobile endpoints (Android cleartext traffic disabled by default in production).
- [ ] Configure automated database snapshots / backups in MongoDB Atlas.
- [ ] Monitor crash rates using Sentry or Datadog.

