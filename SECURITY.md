# Security Policy

## 1. Security Overview

RYDO takes the security of motorcycle riders, telemetry channels, and user personal data seriously. As a platform managing live geolocation coordinates, emergency contacts, and convoy communication, we are committed to maintaining a robust, hardened posture against unauthorized access, data leakage, and real-time eavesdropping.

---

## 2. Supported Versions

Security updates and vulnerability patches are applied to the active development and main branches:

| Version / Branch | Supported | Notes |
|:---|:---:|:---|
| `main` | **Yes** | Current stable production-ready branch |
| `chore/repository-security-and-organization` | **Yes** | Active security and hardening branch |
| Legacy releases (< 1.0.0) | No | Unsupported |

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability or credential exposure within RYDO:

1. **Do Not File a Public Issue:** To protect users and active convoys, please **do not report security vulnerabilities through public GitHub issues, discussions, or pull requests**.
2. **Submit Private Disclosure:**
   - Report the vulnerability directly to the project maintainer via GitHub Private Vulnerability Reporting on the repository:  
     `https://github.com/Jagarlapudiradhakrishna0/RYDO/security/advisories/new`
3. **Include Detailed Information:**
   - Detailed description of the vulnerability.
   - Exact steps or script to reproduce the issue safely.
   - Affected components (`mobile/`, `backend/`, WebSocket layer, or database models).
   - Potential impact on rider privacy, GPS telemetry, or convoy authorization.

---

## 4. Response Timeline & Coordinated Disclosure

- **Acknowledgment:** We aim to acknowledge receipt of security reports within **48 hours**.
- **Assessment & Triage:** A vulnerability severity assessment and patch plan will be communicated within **5 business days**.
- **Fix & Public Advisory:** Once a patch is developed and verified in staging, an update will be deployed and a coordinated security advisory published.

---

## 5. Security Architecture & Best Practices

- **Zero Plaintext Passwords:** Passwords must always be hashed with unique cryptographic salts using PBKDF2 or equivalent before storage.
- **Data Sanitization:** Endpoints returning user data must employ `User.toSafeObject()` to strip credentials and mask emergency contact numbers.
- **Environment Isolation:** Never commit `.env` or credential files to source control. Use environment variables exclusively.
- **WebSocket Room Boundaries:** All real-time telemetry must remain partitioned by convoy `rideCode` rooms (`io.to(rideCode)`).
