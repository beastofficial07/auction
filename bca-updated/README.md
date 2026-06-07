# 🏏 Beast Cricket Auction — Full Stack

Real-time IPL-style cricket player auction platform.

## Quick Start

### 1. Backend
```bash
cd server
npm install
# Edit .env with your MongoDB URI and (optionally) Gmail credentials
npm start
```

### 2. Frontend
```bash
cd client
npm install
npm run dev
```

Open: **http://localhost:3000**

---

## .env Setup (server/.env)

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/beast-cricket-auction
JWT_SECRET=change_this_secret_key
CLIENT_URL=http://localhost:3000

# Optional - leave as-is for dev (auto-verifies accounts)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM=Beast Cricket Auction <your_gmail@gmail.com>
```

> **Gmail**: Account → Security → 2-Step Verification → App Passwords → Generate

---

## User Roles

| Role | What they do |
|------|-------------|
| **Organizer** | Create auctions, add players with photos, create teams, assign team owners, start/control live auction |
| **Team Owner** | Register, get assigned to a team by organizer, join live auction from any device, place bids |
| **Viewer** | Watch any live auction in real-time without login |
| **Admin** | Full platform control, user management |

---

## Multi-Device Auction Flow

1. **Organizer** creates auction → adds players → creates teams → assigns team owners (by email)
2. **Each team owner** logs in on their own device → goes to the auction URL
3. All devices connect to the same **Socket.io room** (auction ID)
4. Organizer clicks **Start Auction** → first player appears on all screens
5. Any team owner clicks **BID** → all devices see the new price instantly
6. Timer runs on server — when it hits 0, player is SOLD → confetti fires on all screens
7. Next player loads automatically

---

## Architecture

```
/server              Express + Socket.io
  models/            MongoDB schemas (User, Auction, Player, Team, Bid)
  routes/            REST API (auth, auctions, admin)
  socket/            Real-time auction engine (in-memory state)
  utils/             JWT, Email (Nodemailer)
  middleware/        JWT auth, role guards

/client              Next.js 14 + TypeScript
  app/               Pages (home, login, register, auctions, dashboards)
  components/        AuthGuard
  hooks/             useAuth
  lib/               api.ts, socket.ts, utils.ts
```

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinAuction` | Client→Server | Join auction room |
| `startAuction` | Organizer→Server | Kick off the auction |
| `placeBid` | Team→Server | Place a bid |
| `bidUpdate` | Server→All | New highest bid |
| `timerTick` | Server→All | Countdown tick |
| `playerSold` | Server→All | Player sold + confetti |
| `playerUnsold` | Server→All | No bids placed |
| `nextPlayer` | Server→All | New player up |
| `auctionCompleted` | Server→All | All done |
| `pauseAuction` | Organizer→Server | Pause |
| `resumeAuction` | Organizer→Server | Resume |
| `skipPlayer` | Organizer→Server | Skip current |
| `forceSell` | Organizer→Server | Force sell now |
