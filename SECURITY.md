# Retrochat Security

This document describes the threat model, secure defaults, and operational guidance.

## Threat model (client-side)

### Assets to protect
- **Message plaintext**: must never be written to persistent storage.
- **Session key** (derived from wallet signature): memory-only.
- **DSK** (device storage key): encrypted at rest; never stored plaintext.
- **Identity private key (X25519)**: encrypted at rest; decrypted only in memory.
- **Backups**: exported as encrypted blobs; never plaintext.

### Primary threats
- **XSS** (script injection): can exfiltrate decrypted plaintext and in-memory keys.
- **Supply-chain compromise**: dependency code executing in the browser.
- **Local device compromise**: attacker reads IndexedDB, caches, or exported backups.
- **Tampering**: attacker modifies stored ciphertext or messages.
- **Unsafe persistence**: leaking secrets into `localStorage`, logs, or analytics.

## Mitigations implemented

### Content Security Policy (CSP)
- **Goal**: block inline scripts as much as feasible.
- In production, set CSP via **HTTP header** (preferred) or meta tag fallback:
  - `index.html` includes `<meta http-equiv="Content-Security-Policy" content="%VITE_CSP%">`
  - `.env.production` defines `VITE_CSP` with `script-src 'self'` (no `'unsafe-inline'`)

### Security headers
- Dev/preview headers are set in `vite.config.ts` (preview is prod-like).
- Deployment recipes live in `public/headers/`.

### No `localStorage` secrets
- The app avoids storing sensitive data in `localStorage` by default.
- Vault keys are memory-only; encrypted vault blobs live in IndexedDB.

### Storage & tamper detection
- Encrypted blobs use **AES-GCM** (authenticating encryption).
- Message rows include tamper checks; decrypt failures are treated as integrity failures.

### Backups (encrypted, integrity checked)
- Exports are encrypted using **PBKDF2(SHA-256) → AES-GCM**.
- Imports validate schema + version and verify:
  - AES-GCM authentication
  - SHA-256 hash match of decrypted payload

### Telemetry (local-only)
- Errors are stored in an in-memory ring buffer only (no network).
- Error messages/stacks are **redacted** to avoid leaking secrets.

## Dependency auditing (pnpm)

Run regularly:

- `pnpm audit`
- `pnpm outdated`
- `pnpm licenses list` (optional, policy-dependent)

Guidance:
- Prefer minimal dependencies in crypto paths.
- Pin or review major upgrades of wallet/transport SDKs.

## Operational notes

- Tighten `connect-src` in CSP to your exact API/XMTP endpoints when known.
- Verify headers in production using browser DevTools → Network → response headers.

