# 🏏 Beast Cricket Auction — Complete Setup Guide

## What's New in This Update

| Feature | Status |
|---|---|
| 💳 Razorpay payment for player registration | ✅ Ready |
| 🔐 Better Auth (Google OAuth + sessions) | ✅ Ready (install needed) |
| ⬅️ Back buttons on every page | ✅ Done |
| 🏠 Role-specific Home buttons | ✅ Done |
| 📸 Instant image upload + real-time player sync | ✅ Done |

---

## 1. Install New Dependencies

### Server
```bash
cd server
npm install razorpay
```

### Client
```bash
cd client
npm install better-auth
```

---

## 2. Configure Environment Variables

### server/.env
Copy from `server/.env.example` and fill in:

```env
# Razorpay — sign up free at razorpay.com
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Better Auth
BETTER_AUTH_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### client/.env.local
```env
# Razorpay public key (safe to expose)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx

# Better Auth
BETTER_AUTH_SECRET=<same secret as server>
BETTER_AUTH_URL=http://localhost:3000
```

---

## 3. Razorpay Setup (Free)

1. Go to [razorpay.com](https://razorpay.com) → Sign Up (free)
2. Dashboard → Settings → API Keys → **Generate Test Key**
3. Copy `Key ID` → `RAZORPAY_KEY_ID`
4. Copy `Key Secret` → `RAZORPAY_KEY_SECRET`
5. **Test cards:** `4111 1111 1111 1111` / any future date / any CVV
6. For production, switch to Live keys and complete KYC

**Registration fee** is set per auction (default ₹199 = 19900 paise).
To change it, update `registrationFee` when creating an auction.

---

## 4. Better Auth Setup (Google OAuth)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project → Enable Google+ API
3. Credentials → Create OAuth 2.0 Client ID
4. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add to `.env`: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
6. Uncomment `socialProviders.google` in `client/lib/auth-server.ts`

**Note:** Better Auth works *alongside* the existing JWT auth. You don't have to switch.

---

## 5. Cloudinary Setup (Images visible everywhere)

For player photos to be permanently accessible to all users:

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier: 25GB)
2. Dashboard → copy Cloud Name, API Key, API Secret
3. Add to `server/.env`:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Without Cloudinary, images are stored locally and won't be visible in production.

---

## 6. How Payment Flow Works

```
Player fills form → Photo uploads instantly to Cloudinary
         ↓
   Click "Pay ₹199 & Register"
         ↓
   Server creates Razorpay order
         ↓
   Razorpay checkout popup (UPI / card / net banking)
         ↓
   Payment success → server verifies HMAC-SHA256 signature
         ↓
   Player saved to DB
         ↓
   Socket.io emits 'playerRegistered' → organizer dashboard updates INSTANTLY
         ↓
   Player photo visible in organizer dashboard immediately
```

---

## 7. Dev Mode (No Razorpay Keys)

If `RAZORPAY_KEY_ID` is not set, the app runs in **dev mode**:
- Payment UI is skipped
- Players register without a payment
- A warning is shown: `⚠️ Dev mode: skipping live payment`

This lets you develop and test the full flow without real Razorpay credentials.

---

## 8. Back Button Behaviour

Every page now has a `←` back button in the **top-left corner**:
- If there's browser history → goes back
- If opened fresh (no history) → goes to `/`
- Dashboard pages → shows "Main Home" (returns to `/`)
- Auth pages → shows "Back to Login"

Dashboard **Home** buttons always go to the **role-specific homepage**:
- Organizer: `/dashboard/organizer`
- Team Owner: `/dashboard/team-owner`
- Viewer: `/dashboard/viewer`
- Admin: `/dashboard/admin`

---

## 9. Start the App

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

Visit: http://localhost:3000
