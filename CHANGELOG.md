# RYDO — Changelog & Modernization History

All notable changes, dependency upgrades, bug fixes, and architectural enhancements are documented in this file.

---

## [2.0.0] — 2026-11-08 (Complete Modernization & SDK 58 Upgrade)

### 🚀 Major Framework & SDK Upgrades
* **Expo SDK:** Upgraded from `57.0.25` to `58.0.23` (Latest Stable).
* **React Native:** Upgraded from `0.86.3` to `0.88.1`.
* **React & React DOM:** Upgraded from `19.2.3` to `19.3.0`.
* **TypeScript:** Upgraded from `5.9.2` to `6.0.3` for strict type resolution.
* **React Native Maps:** Aligned to `1.29.11`.
* **React Native WebView:** Upgraded to `14.0.1`.
* **React Native Reanimated:** Aligned to `4.7.1` with native `react-native-worklets@0.13.0`.
* **Expo Router:** Aligned to `~58.0.30` with `@expo/ui@~58.0.27`.
* **Backend Dependencies:**
  * `express`: Upgraded to `5.3.0`.
  * `mongoose`: Upgraded to `9.12.0` (with `mongodb@7.8.0`).
  * `socket.io`: Upgraded to `4.8.4`.

### 🛡️ Security & Vulnerability Resolutions
* Eliminated 7 high/critical transitive CVE vulnerabilities in backend (`body-parser`, `engine.io`, `proxy-addr`, `brace-expansion`, `qs`) via non-destructive semantic dependency alignment.
* Verified constant-time PBKDF2 salt-based authentication via `crypto.timingSafeEqual`.
* Strengthened `toSafeObject()` on user schema to prevent accidental leakage of password credentials.

### 🐛 Bug Fixes & Code Improvements
* **StatusBar Cross-Platform Standard:** Replaced unportable React Native `StatusBar` with `expo-status-bar` (`style="light"`) across all 11 screens.
* **ScrollView Ref Typing:** Resolved React 19 forwardRef typing mismatch using `React.ComponentRef<typeof ScrollView>`.
* **RydoMap ForwardRef Display Name:** Added `RydoMap.displayName = 'RydoMap'` to comply with React component standards.
* **Complex Dependencies in Hooks:** Extracted inline JSON stringification and ternary calculations out of `useMemo` / `useEffect` dependency arrays in `captain-dashboard.tsx` and `rider-dashboard.tsx`.
* **SSR Window Guarding:** Added `typeof window !== 'undefined'` protections in `ttsService.ts` and `communicationSettings.ts` to prevent static export bundling crashes.
* **MessagePopup Hoisting:** Corrected declaration order of `dismissPopup()` in `components/MessagePopup.tsx`.
* **app.json Schema Conformance:** Removed deprecated `newArchEnabled` and unmapped `usesCleartextTraffic` properties, achieving 20/20 checks passed in `expo-doctor`.

### ⚡ Architecture & Performance Optimizations
* **Graceful Shutdown:** Implemented clean HTTP server and MongoDB connection teardown on `SIGINT` / `SIGTERM` in `backend/server.js`.
* **MongoDB Indexing:** Added indexes on `{ phoneNumber: 1 }` and `{ rideCode: 1, createdAt: 1 }` for sub-millisecond query lookups.
* **Native Integration Test Suite:** Created `backend/tests/integration.test.js` using Node.js's native test runner (13/13 tests passing with 100% success rate).

