# 🌍 Deploy Beast Cricket Auction — Anyone Can Access It

## Best Free Option: Railway (Backend) + Vercel (Frontend)

---

## STEP 1 — Free MongoDB Database (Atlas)

1. Go to **https://mongodb.com/atlas** → Sign Up free
2. Create a **free M0 cluster** (512MB — enough for hundreds of auctions)
3. Click **Connect** → **Compass** → copy the connection string:
   ```
   mongodb+srv://username:password@cluster0.abc.mongodb.net/beast-cricket
   ```
4. In **Network Access** → Add IP → **Allow Access from Anywhere** (0.0.0.0/0)
5. Save the connection string — you'll need it in Step 2

---

## STEP 2 — Deploy Backend on Railway (Free)

**Railway** gives you a free server that runs 24/7.

1. Go to **https://railway.app** → Sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
   - If you don't have GitHub: **New Project** → **Deploy from local** → upload the `bca/server` folder
3. Set the **Root Directory** to `server` (repo root: `client` for frontend, `server` for backend)
4. Railway auto-detects Node.js and runs `node server.js`

### Set Environment Variables in Railway:
Click your project → **Variables** → Add each one:

```
NODE_ENV          = production
MONGODB_URI       = mongodb+srv://user:pass@cluster.mongodb.net/beast-cricket
JWT_SECRET        = BeastCricket_AnyLongRandomString_2026!
CLIENT_URL        = https://your-app.vercel.app    ← fill after Step 3
EMAIL_HOST        = smtp.gmail.com
EMAIL_PORT        = 587
EMAIL_USER        = yourgmail@gmail.com
EMAIL_PASS        = your_16_char_app_password
EMAIL_FROM        = Beast Cricket Auction <yourgmail@gmail.com>
```

5. Click **Deploy** → wait 2 minutes
6. Go to **Settings** → copy your URL: `https://beast-cricket-xxx.up.railway.app`

### Test it works:
Open: `https://beast-cricket-xxx.up.railway.app/api/health`
Should show: `{"ok":true,"env":"production"}`

---

## STEP 3 — Deploy Frontend on Vercel (Free)

**Vercel** is made by the Next.js team — perfect match, free forever.

1. Go to **https://vercel.com** → Sign up with GitHub
2. Click **Add New Project** → upload / import the `bca/client` folder
3. Vercel auto-detects Next.js

### Set Environment Variables in Vercel:
Click **Settings** → **Environment Variables** → Add:

```
NEXT_PUBLIC_API_URL    = https://beast-cricket-xxx.up.railway.app
NEXT_PUBLIC_SOCKET_URL = https://beast-cricket-xxx.up.railway.app
```

4. Click **Deploy** → wait 2 minutes
5. Copy your URL: `https://beast-cricket-yyy.vercel.app`

---

## STEP 4 — Link Frontend URL Back to Backend

1. Go back to **Railway** → your project → **Variables**
2. Update `CLIENT_URL` to your Vercel URL:
   ```
   CLIENT_URL = https://beast-cricket-yyy.vercel.app
   ```
3. Railway auto-redeploys

---

## STEP 5 — Test Everything

Open your Vercel URL: `https://beast-cricket-yyy.vercel.app`

1. ✅ Homepage loads with cricket stadium
2. ✅ Register → get verification email (if Gmail configured)
3. ✅ Login → select role → dashboard opens
4. ✅ Organizer creates auction → join code generated
5. ✅ Team owner enters code → creates team
6. ✅ Live auction → bid buttons work
7. ✅ Multiple devices work simultaneously

---

## Custom Domain (Optional)

### Vercel (Frontend):
1. Go to your project → **Domains** → Add domain
2. Enter `beastcricket.com` (or whatever you bought)
3. Vercel gives you DNS records to add at your domain registrar (GoDaddy, Namecheap etc.)

### Railway (Backend):
1. Go to your service → **Settings** → **Domains**  
2. Add `api.beastcricket.com`
3. Update `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` in Vercel to `https://api.beastcricket.com`
4. Update `CLIENT_URL` in Railway to `https://beastcricket.com`

---

## Alternative: Render (Backend) instead of Railway

If Railway has issues:

1. Go to **https://render.com** → Sign Up
2. **New** → **Web Service** → connect GitHub or upload
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `node server.js`
5. Add same environment variables as Railway
6. Free tier: service sleeps after 15 mins of inactivity (wakes in ~30 sec)

---

## Cost Summary

| Service | Cost | What it does |
|---------|------|-------------|
| MongoDB Atlas | FREE (512MB) | Database |
| Railway | FREE ($5/mo credit) | Backend server |
| Vercel | FREE (hobby) | Frontend hosting |
| Gmail SMTP | FREE | Verification emails |
| **Total** | **₹0** | Full production app |

For a paid upgrade (no sleep, more storage):
- Railway Hobby: $5/month
- MongoDB Atlas M2: $9/month
- Vercel Pro: $20/month (not needed for most cases)

---

## Troubleshooting

**CORS error in browser console:**
→ Check `CLIENT_URL` in Railway matches your Vercel URL exactly (no trailing slash)

**Socket.io not connecting:**
→ Make sure `NEXT_PUBLIC_SOCKET_URL` points to Railway URL (not localhost)
→ Railway supports WebSocket by default ✅

**Images not showing after upload:**
→ Note: Railway's free tier has **ephemeral storage** — uploaded files disappear on redeploy
→ Solution: Use **Cloudinary** for image storage (see below)

**"MongoServerError" on startup:**
→ Check your MONGODB_URI is correct
→ Make sure Atlas IP whitelist includes 0.0.0.0/0

---

## Persistent Image Storage (Cloudinary — Free)

Railway's filesystem resets on each deploy. For permanent player photos:

1. Sign up at **https://cloudinary.com** (free: 25GB)
2. Get your Cloud Name, API Key, API Secret from Dashboard
3. Add to Railway environment variables:
   ```
   CLOUDINARY_CLOUD_NAME = your_cloud_name
   CLOUDINARY_API_KEY    = your_api_key
   CLOUDINARY_API_SECRET = your_api_secret
   ```
4. Install in server: `npm install cloudinary multer-storage-cloudinary`

This stores all player photos and team logos permanently in the cloud.

