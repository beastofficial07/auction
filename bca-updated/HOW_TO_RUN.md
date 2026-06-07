# 🏏 Beast Cricket Auction — Setup & Run

---

## REQUIREMENTS (install once)

1. **Node.js 18+** → https://nodejs.org → Download "LTS" version → Install
2. **MongoDB** → https://www.mongodb.com/try/download/community → Install Community Edition

---

## STEP 1 — START MONGODB

MongoDB must be running before the server starts.

**Windows (Command Prompt as Administrator):**
```
net start MongoDB
```

**Mac:**
```
brew services start mongodb-community
```

**Linux:**
```
sudo systemctl start mongod
```

---

## STEP 2 — START THE BACKEND SERVER

Open a terminal, go into the `bca/server` folder:

```bash
cd bca/server
npm install
node server.js
```

**You must see this output:**
```
✅ MongoDB connected
🚀 Beast Cricket Auction Server running
   URL    : http://localhost:5000
   Health : http://localhost:5000/api/health
   Email  : ⚠️  not configured — accounts auto-verified
```

**Test it works:** Open http://localhost:5000/api/health in your browser.
You should see: `{"ok":true}`

If you see an error instead → MongoDB is not running (go back to Step 1).

---

## STEP 3 — START THE FRONTEND

Open a SECOND terminal, go into the `bca/client` folder:

```bash
cd bca/client
npm install
npm run dev
```

**You must see:**
```
▲ Next.js 14.2.5
✓ Ready
- Local: http://localhost:3000
```

---

## STEP 4 — OPEN THE APP

Open your browser: **http://localhost:3000**

You will see the Beast Cricket Auction homepage with a cricket stadium.

---

## STEP 5 — REGISTER AN ACCOUNT

1. Click **GET STARTED** on the homepage
2. Enter: Name, Email (any email like `test@gmail.com`), Password (min 6 chars), Confirm password
3. Click **CREATE ACCOUNT**
4. Since email is not configured, you'll see **"Account Ready!"**
5. Click **LOGIN NOW**

---

## STEP 6 — LOGIN

1. On the login page, click a role: **Organizer**, **Team Owner**, or **Viewer**
2. Enter your email and password
3. Click **SIGN IN**
4. You'll be taken to your dashboard

---

## EMAIL VERIFICATION (real emails)

By default, email verification is SKIPPED — accounts are auto-verified.

To send real verification emails:

1. Go to **myaccount.google.com**
2. **Security** → **2-Step Verification** → Turn ON
3. **Security** → **App passwords** → Create one → Copy the 16-char password

4. Edit `bca/server/.env`:
```
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=abcdefghijklmnop
CLIENT_URL=http://localhost:3000
```

5. Restart the server: Ctrl+C → `node server.js`

Now when someone registers, they get a real email with a verify button.
When they click it, they land on the verify page and get confirmed.

---

## FOR MULTIPLE LAPTOPS (team bidding)

Find your computer's IP:
- **Windows:** Open Command Prompt → type `ipconfig` → look for **IPv4 Address** (e.g. 192.168.1.105)
- **Mac:** System Settings → Wi-Fi → your network → IP address
- **Linux:** `hostname -I`

Edit `bca/server/.env`:
```
CLIENT_URL=http://192.168.1.105:3000
```

Edit `bca/client/.env.local`:
```
NEXT_PUBLIC_API_URL=http://192.168.1.105:5000
NEXT_PUBLIC_SOCKET_URL=http://192.168.1.105:5000
```

Start frontend with:
```bash
npm run dev -- --hostname 0.0.0.0
```

All laptops on the same WiFi open: **http://192.168.1.105:3000**

---

## TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| `Registration failed` | Server not running — run `node server.js` |
| `MongoDB connection failed` | Start MongoDB (Step 1) |
| `Network Error` / blank page | Server not running on port 5000 |
| `Port 5000 already in use` | Add `PORT=5001` to server/.env AND change `NEXT_PUBLIC_API_URL=http://localhost:5001` in client/.env.local |
| Login says `No account found` | Register first at /register |
| Login says `Email not verified` | Email is configured but not verified — check inbox or set EMAIL_USER=your_email@gmail.com to skip |
| `npm install` fails | Node.js not installed — download from nodejs.org |

