# RYDO — Mobile Application Architecture & Screen Documentation

This document describes the mobile client architecture, screen flows, state management, components, and real-time event lifecycle for the RYDO mobile application (Expo SDK 58 / React Native 0.88.1).

---

## 1. Directory Structure

```
mobile/
├── app/                           # Expo Router File-Based Navigation
│   ├── _layout.tsx                # Root navigation stack & theme provider
│   ├── index.tsx                  # Splash / Onboarding screen
│   ├── ride-choice.tsx            # Role selection (Captain vs Rider)
│   ├── login.tsx                  # User authentication login
│   ├── register.tsx               # User account registration
│   ├── create-ride.tsx            # Convoy creation form
│   ├── ride-created.tsx           # Convoy passkey display & share
│   ├── join-ride.tsx              # Convoy code entry screen
│   ├── captain-dashboard.tsx      # Lead rider telemetry & management
│   ├── rider-dashboard.tsx        # Convoy participant dashboard
│   ├── live-ride-map.tsx          # Fullscreen Leaflet GPS map
│   ├── route-planner.tsx          # Waypoint sequencing & route builder
│   ├── communication.tsx          # In-convoy audio chat & messaging
│   └── profile.tsx                # Rider profile & emergency contact
├── components/                    # Reusable UI & Map Components
│   ├── RydoMap.tsx                # High-performance Leaflet WebView map
│   ├── MessagePopup.tsx           # Floating in-ride broadcast notifications
│   ├── ErrorBoundary.tsx          # React error boundary safety wrapper
│   └── OfflineNotice.tsx          # Network connectivity alert banner
├── services/                      # Client Business Logic & Hardware Bridges
│   ├── api.ts                     # Axios client with JWT interceptors
│   ├── socket.ts                  # Socket.IO connection manager & reconnect logic
│   ├── locationService.ts         # Expo Location foreground/background tracking
│   ├── audioService.ts            # Sound effects & siren audio player
│   ├── ttsService.ts              # Speech synthesis engine (Web & Native)
│   ├── communicationSettings.ts   # Persistent user audio/TTS preferences
│   ├── sosService.ts              # Emergency broadcast triggers
│   └── storage.ts                 # AsyncStorage abstraction
├── app.json                       # Expo configuration & app permissions
└── package.json                   # Dependencies (Expo 58, RN 0.88.1, React 19)
```

---

## 2. Core User Flows

### 2.1 Captain (Convoy Leader) Flow
```
[Splash / Onboarding]
         │
         ▼
[Role Selection: Captain] ──(Requires Auth)──► [Login / Register]
         │
         ▼
[Create Convoy: Name, Route, Waypoints]
         │
         ▼
[Convoy Created: 6-Character Code Displayed]
         │
         ▼
[Captain Dashboard]
   ├── Start / Pause / End Convoy Lifecycle
   ├── Monitor Real-Time Rider Grid & Battery Levels
   ├── Fullscreen Interactive Leaflet Map
   ├── Broadcast Audio / TTS Convoy Messages
   └── Trigger / Monitor SOS Alerts
```

### 2.2 Rider (Participant) Flow
```
[Splash / Onboarding]
         │
         ▼
[Role Selection: Rider] ──(Requires Auth)──► [Login / Register]
         │
         ▼
[Join Convoy: Enter 6-Character Ride Code]
         │
         ▼
[Rider Dashboard]
   ├── Toggle Live GPS Broadcast (Active / Suspended)
   ├── View Convoy Status (Pending, Active, Completed)
   ├── View Distance to Captain & Convoy Formation
   ├── In-Convoy Communication & Voice Announcements
   └── One-Tap SOS Alert with Immediate Confirmation
```

---

## 3. Screen Breakdown

### `app/index.tsx` (Splash Screen)
- Apple-inspired minimalist entrance.
- Checks local token in `AsyncStorage`. If authenticated, offers direct re-entry to previous active session.

### `app/captain-dashboard.tsx`
- **Convoy Telemetry Bar:** Active rider count, elapsed time, average speed.
- **Ride State Controls:** Initiates `PATCH /api/rides/:rideCode/status` to broadcast start/stop events across all convoy members.
- **Rider Card Grid:** Shows participant names, connectivity status, and last reported location timestamp.
- **Embedded Map Preview:** Inline view of `RydoMap` showing real-time clustering.

### `app/rider-dashboard.tsx`
- **Convoy Status Banner:** Real-time updates when Captain starts or pauses the ride.
- **Location Broadcast Toggle:** Enables or pauses high-accuracy GPS telemetry.
- **Quick Audio Announcements:** Quick tap preset alerts ("Refueling", "Mechanical Issue", "Regrouping").

### `components/RydoMap.tsx`
- **Engine:** React Native WebView hosting OpenStreetMap with Leaflet.js.
- **Custom Styling:** High-contrast dark tile layer matching Swiss aesthetic.
- **Markers:** Custom SVG/CSS pulses for Captain (gold star indicator), Riders (high-contrast white pings), and SOS (flashing emergency red ping).
- **Polyline:** Renders convoy route path and waypoints.
- **Battery Optimization:** Throttled communication bridge over `postMessage` preventing frame rate drops during continuous GPS updates.

### `app/communication.tsx`
- In-ride text messaging with automated speech synthesis.
- Incoming captain instructions are read aloud via `ttsService.ts` to allow hands-free communication while riding.

---

## 4. Hardware Services & Native Permissions

### Geolocation (`services/locationService.ts`)
- Utilizes `expo-location`.
- Requires Android permissions:
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_COARSE_LOCATION`
- Frequency throttling: Updates emitted at maximum 2.5-second intervals or 10-meter displacement to preserve device battery during long touring rides.

### Audio & Text-to-Speech (`services/ttsService.ts` & `audioService.ts`)
- Audio alerts use `expo-av` for emergency siren sounds.
- Voice synthesis utilizes platform-native TTS engines with full Web-safety fallbacks for multiplatform stability.

