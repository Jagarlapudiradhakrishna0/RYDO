# Contributing to RYDO

Thank you for your interest in contributing to RYDO — the collaborative motorcycle convoy and group ride management platform.

This guide outlines our development workflow, coding standards, branch conventions, and testing requirements to ensure high software quality across our React Native / Expo mobile app and Node.js / Express / Socket.IO backend.

---

## 1. Development Principles

- **Swiss Minimalist Aesthetic:** The mobile interface strictly follows a high-contrast black-and-white theme (`#000000`, `#FFFFFF`, `#1C1C1E`, `#2C2C2E`, `#8E8E93`) with Apple Human Interface Guidelines spacing, typography, and haptics. Do not introduce saturated color palettes outside critical safety indicators (SOS amber/red).
- **Zero Mock / Placeholder Policy:** Do not commit stubbed features, mock network layers, or synthetic UI states in place of actual operational logic.
- **Strict TypeScript:** All mobile code must be strongly typed without bypassing errors through indiscriminate `any` or `@ts-ignore` pragmas.
- **Fail-Safe Real-Time Operations:** Sockets and geolocation services must always implement exponential backoff reconnection, graceful degradation, and background battery protection.

---

## 2. Getting Started

### Prerequisites

- **Node.js:** `v20.x` or `v22.x` (LTS recommended)
- **npm:** `v10.x` or higher
- **Expo CLI:** Expo SDK 58 tooling (`npx expo`)
- **MongoDB:** Local instance (`mongodb://127.0.0.1:27017/rydo`) or MongoDB Atlas cluster URI
- **Mobile Environment:**
  - Android Studio with Android Virtual Device (AVD), or
  - Physical Android / iOS device running Expo Go (SDK 58 compatible)

### Repository Setup

```bash
# Clone the repository
git clone https://github.com/Jagarlapudiradhakrishna0/RYDO.git
cd RYDO

# Install root & workspace dependencies
npm install
cd backend && npm install
cd ../mobile && npm install
```

---

## 3. Branching Strategy

- `main` — Production-ready, fully tested codebase.
- `modernization-sdk-audit` — Upgrades, dependency alignments, and framework modernization.
- `feat/<feature-name>` — New features (e.g. `feat/turn-by-turn-audio`).
- `fix/<issue-name>` — Bug and security fixes (e.g. `fix/socket-reconnect-leak`).
- `docs/<doc-name>` — Documentation enhancements.

---

## 4. Coding Standards

### Mobile (React Native / Expo SDK 58)

- **Components:** Functional components with React Hooks.
- **Refs:** When referencing native components (e.g. `ScrollView`, `WebView`), type refs using `React.ComponentRef<typeof Component>` to align with React 19 typings.
- **Status Bar:** Use `import { StatusBar } from 'expo-status-bar'` with `<StatusBar style="light" />`.
- **Navigation:** Use file-based routing via `expo-router`.
- **Platform Safety:** When accessing browser globals (`window`, `localStorage`, `SpeechSynthesis`), wrap with `if (typeof window !== 'undefined')` to support Expo static web exports.

### Backend (Node.js / Express 5 / Socket.IO)

- **Architecture:** Controller-Service-Model design with Express Router.
- **Error Handling:** Standardized JSON error envelopes: `{ success: false, message: string, error?: string }`.
- **Database:** Mongoose 9 models with explicit schema validation, indexes, and timestamps.
- **Socket Events:** Room-isolated broadcasts (`io.to(rideCode).emit(...)`) to eliminate cross-convoy data leaks.

---

## 5. Verification & Testing Checklist

Before submitting a Pull Request, run the complete verification suite:

```bash
# 1. Backend Integration Tests
cd backend
npm test

# 2. Frontend Type Checking
cd ../mobile
npx tsc --noEmit

# 3. Frontend Linting
npm run lint

# 4. Expo Health & Compatibility Check
npx expo-doctor

# 5. Static Web Bundle Verification
npx expo export --platform web
```

All 5 checks must pass with **0 errors**.

---

## 6. Submitting a Pull Request

1. Create a clear, descriptive branch name.
2. Commit your changes with conventional commit messages:
   - `feat: add offline queue for rider telematics`
   - `fix: resolve double listener registration on ride re-entry`
   - `docs: update API endpoints for ride status PATCH`
3. Push your branch to GitHub and open a Pull Request targeting `main`.
4. Include a concise summary of changes, test commands executed, and screenshots or screen recordings for UI modifications.

