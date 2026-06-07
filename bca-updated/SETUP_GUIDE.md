# 🏏 Beast Cricket Auction — Full Setup Guide

## What's New in This Update

### 1. 💳 Payment Integration (Razorpay)
- **Player Registration**: players pay a fee (default ₹199) before being added to an auction
- **Auction Creation**: organizers pay a one-time fee (₹499) to create an auction
- All payments verified server-side with HMAC-SHA256 — cannot be bypassed
- Works in **dev mode** automatically if Razorpay keys are not set (for local dev)

### 2. ⚡ Full Live Socket Updates
- New auctions appear instantly on the public auctions listing for ALL users
- Auction status changes (draft → active → completed) broadcast globally
- Player registrations appear instantly in the organizer dashboard
- Bid updates, sold events, RTM triggers — all real-time

### 3. 🔒 Security & Auth
- Better Auth config files added (`client/lib/auth-server.ts`, `client/lib/auth.ts`)
- All payment routes require authentication for organizer actions
- Back buttons on every page
- Role-specific home buttons in all dashboards

---

## Quick Start

### 1. Server
```bash
cd server
npm install
cp .env.example .env     # fill in your values
npm run dev
```

### 2. Client
```bash
cd client
npm install
# Create client/.env.local:
# NEXT_PUBLIC_API_URL=http://localhost:5000/api
# NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
npm run dev
```

---

## Razorpay Setup (Free)

1. Sign up at [razorpay.com](https://razorpay.com) — completely free
2. Go to **Dashboard → Settings → API Keys**
3. Generate **Test Keys** (no real money during testing)
4. Add to `server/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
   ```
5. Test cards:
   - Card: `4111 1111 1111 1111` · Any future date · Any CVV
   - UPI: `success@razorpay`

### Fee Configuration
| Event | Default Fee | Env Variable |
|-------|------------|--------------|
| Player Registration | ₹199 | Set per-auction in organizer dashboard |
| Auction Creation | ₹499 | `AUCTION_CREATION_FEE_PAISE=49900` |

---

## Better Auth Setup (Optional — adds Google OAuth)

```bash
cd client
npm install better-auth
```

Then in `client/lib/auth-server.ts`, uncomment the `socialProviders.google` block and set:
```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```
Get these from [console.cloud.google.com](https://console.cloud.google.com).

---

## Socket Events Reference

| Event | Direction | Description |
|-------|-----------|-------------|
| `auctionCreated` | server → all clients | New auction created after payment |
| `auctionStatusChanged` | server → all clients | Auction goes active/paused/completed |
| `playerRegistered` | server → auction room | Player registered after payment |
| `bidUpdate` | server → auction room | New bid placed |
| `playerSold` | server → auction room | Player sold to team |
| `timerTick` | server → auction room | Countdown tick |
| `auctionStarted` | server → auction room | Organizer started the auction |
| `auctionCompleted` | server → auction room | All players auctioned |

---

## File Changes Summary

### Server (new/modified)
- `routes/payment.js` — ALL payment routes
- `socket/auctionEngine.js` — Enhanced with global broadcasts
- `models/Auction.js` — Added `registrationFee`, `registrationFeeEnabled`
- `server.js` — Payment route registered, `io` exposed to routes

### Client (new/modified)
- `app/auctions/[id]/register-player/page.tsx` — Full Razorpay payment flow
- `app/dashboard/organizer/page.tsx` — Auction creation with payment
- `app/auctions/page.tsx` — Live socket updates
- `lib/socket.ts` — Robust reconnection
- `lib/auth.ts` — Better Auth config
- `lib/auth-server.ts` — Better Auth server config
- `app/login/page.tsx` — Back button
- `app/register/page.tsx` — Back button
- `app/forgot-password/page.tsx` — Back button
- `app/reset-password/page.tsx` — Back button
- `app/verify-email/page.tsx` — Back button
- All dashboard pages — Role-specific home buttons, back buttons
