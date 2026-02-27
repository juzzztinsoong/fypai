# LAN Testing Setup (Phase 6.5.5)

This guide enables multi-device testing on a local network.

## 0) Initialize on a New Host (one-time)

From repo root:

```powershell
# Install workspace deps
npm install

# Build shared DTO/types package used by frontend/backend
cd packages/types
npm run build
cd ../..
```

Backend env setup (`backend/.env`):

```env
DATABASE_URL="file:./dev.db"
PORT=5000

# Optional but recommended for AI features
GITHUB_TOKEN=your_github_models_token

# IMPORTANT for LAN clients (CORS allowlist)
# Use the host machine frontend origin, not localhost
FRONTEND_URL=http://192.168.1.23:3000

# Optional: allow additional frontend origins (comma-separated)
# Example when teammates run frontend on their own machines:
# FRONTEND_URLS=http://192.168.1.23:3000,http://192.168.1.50:3000
```

## 1) Initialize / Sync Database Schema (Prisma)

Run on host machine:

```powershell
cd backend

# Generate Prisma client from schema
npm run db:generate

# Apply migrations to local DB (creates/updates dev.db)
npm run db:migrate

# Optional: seed baseline users/teams/messages
npm run db:seed
```

Useful checks:

```powershell
# Open DB browser
npm run db:studio

# Prisma schema source of truth
# backend/prisma/schema.prisma
```

## 2) (If Needed) Clear + Reseed Database

Use this when switching to a clean LAN test cycle, after schema drift/conflicts, or if test data is corrupted.

```powershell
cd backend

# Project reset script (drops/recreates and clears data)
npm run db:reset

# Re-apply schema if reset script did not run migrations
npm run db:generate
npm run db:migrate

# Seed baseline data
npm run db:seed
```

If you only want to reset via Prisma directly:

```powershell
cd backend
npx prisma migrate reset
```

## 3) Find Host Machine IP

Run on the host machine:

```powershell
ipconfig | Select-String "IPv4"
```

Use the IPv4 of your active adapter (example: `192.168.1.23`).

## 4) Configure Frontend Environment

Create or update `frontend/.env.local`:

```env
VITE_API_URL=http://192.168.1.23:5000/api
VITE_WS_URL=http://192.168.1.23:5000
```

Replace `192.168.1.23` with your host machine IPv4.

If `frontend/.env.local` is missing, the frontend falls back to `localhost`,
which breaks API/socket calls on other devices and can leave the app stuck on
`Loading... Initializing application`.

Note: `VITE_API_URL` must include `/api`.

## 5) Allow Firewall Rules (Windows, run as Admin)

```powershell
New-NetFirewallRule -DisplayName "FYP AI Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "FYP AI Backend" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow

# Verify rules were created
Get-NetFirewallRule -DisplayName "FYP AI Frontend","FYP AI Backend"
```

## 6) Start Services

Backend:

```powershell
cd backend
npm run dev
```

Frontend:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0 --port 3000
```

## 7) Access from Other Devices

On each client device browser:

- Frontend URL: `http://192.168.1.23:3000`

## 8) Multi-User Test Flow

- Use the built-in user switcher in the sidebar (`user1`, `user2`, `user3`).
- Join the same team on multiple devices.
- Validate real-time chat sync, typing indicators, and AI replies.

## 9) Session Reset Between Participants

- In Sidebar → **Session Reset** → click **Reset Current Team**.
- This clears all team messages and resets local typing/AI processing indicators.

## Quick Troubleshooting

- If a client cannot connect, verify:
  - Both devices are on the same network.
  - Correct host IPv4 is used in `VITE_API_URL`/`VITE_WS_URL`.
  - Firewall rules are present.
  - Backend is running on port `5000`.
- If backend fails after pulling latest code, run:
  - `cd packages/types && npm run build`
  - `cd ../../backend && npm run db:generate && npm run db:migrate`
- If API works but test users/teams are missing, run `npm run db:seed` in `backend`.
- If UI is stuck on `Loading... Initializing application` on LAN clients:
  - Ensure `frontend/.env.local` uses host IP for both `VITE_API_URL` and `VITE_WS_URL`.
  - Ensure `backend/.env` sets `FRONTEND_URL=http://<HOST_IP>:3000`.
  - Restart backend and frontend after env changes.
- If data loads but realtime actions fail (no team join / no live updates):
  - Check backend logs for `[CORS] Blocked Socket.IO origin`.
  - Add the client frontend origin to `FRONTEND_URLS` in `backend/.env`.
  - Restart backend after updating env.
