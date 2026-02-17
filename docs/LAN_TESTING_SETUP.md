# LAN Testing Setup (Phase 6.5.5)

This guide enables multi-device testing on a local network.

## 1) Find Host Machine IP

Run on the host machine:

```powershell
ipconfig | Select-String "IPv4"
```

Use the IPv4 of your active adapter (example: `192.168.1.23`).

## 2) Configure Frontend Environment

Create or update `frontend/.env.local`:

```env
VITE_API_URL=http://192.168.1.23:5000
VITE_WS_URL=http://192.168.1.23:5000
```

Replace `192.168.1.23` with your host machine IPv4.

## 3) Allow Firewall Rules (Windows, run as Admin)

```powershell
New-NetFirewallRule -DisplayName "FYP AI Frontend" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "FYP AI Backend" -Direction Inbound -Port 5000 -Protocol TCP -Action Allow
```

## 4) Start Services

Backend:

```powershell
cd backend
npm run dev
```

Frontend:

```powershell
cd frontend
npm run dev
```

## 5) Access from Other Devices

On each client device browser:

- Frontend URL: `http://192.168.1.23:3000`

## 6) Multi-User Test Flow

- Use the built-in user switcher in the sidebar (`user1`, `user2`, `user3`).
- Join the same team on multiple devices.
- Validate real-time chat sync, typing indicators, and AI replies.

## 7) Session Reset Between Participants

- In Sidebar → **Session Reset** → click **Reset Current Team**.
- This clears all team messages and resets local typing/AI processing indicators.

## Quick Troubleshooting

- If a client cannot connect, verify:
  - Both devices are on the same network.
  - Correct host IPv4 is used in `VITE_API_URL`/`VITE_WS_URL`.
  - Firewall rules are present.
  - Backend is running on port `5000`.
