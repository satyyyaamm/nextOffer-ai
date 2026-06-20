# JobCraft AI — Setup Guide

You only need to **create a Firebase project**, **paste keys**, and **deploy**. Everything else is handled.

---

## Prerequisites

- Node.js 18+
- A Google account
- ~20 minutes

---

## Step 1: Firebase Project (5 min)

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Enable these services:
   - **Authentication** → Sign-in method → **Google** → Enable
   - **Firestore Database** → Create database → **Production mode** (our rules block all client access)
   - **Functions** → Upgrade to Blaze plan (pay-as-you-go; free tier covers early usage)

3. **Project Settings → General → Your apps → Web** → Register app → Copy config values

4. **Authentication → Settings → Authorized domains** → Add `localhost` and your production domain

5. **Firestore** → If login shows "Failed to fetch", deploy rules: `firebase deploy --only firestore:rules`

6. **Cloud Run (for Parse Resume / Search)** — [Cloud Run Console](https://console.cloud.google.com/run?project=nextoffer-ai) → each service (`getuserprofile`, `parseresume`, etc.) → **Permissions** → Grant **allUsers** the role **Cloud Run Invoker**

---

## Step 2: Get API Keys (5 min)

| Key | Where |
|-----|-------|
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **RapidAPI (JSearch)** | [Subscribe free](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) → copy `X-RapidAPI-Key` |
| **Jooble** (optional) | [jooble.org/api/about](https://jooble.org/api/about) → request API key |
| **Adzuna** (optional) | [developer.adzuna.com](https://developer.adzuna.com/) → App ID + App Key |
| **Razorpay** | **$5.99/week** or **$9.99/month** (display) — INR plans in Razorpay — see **[PAYMENTS.md](./PAYMENTS.md)** |

JSearch is required. Jooble and Adzuna are optional — if omitted, search still works with JSearch only.

---

## Step 3: Configure Frontend (2 min)

```bash
cd files
npm install
cp .env.local.example .env.local
```

Edit `.env.local` — **Firebase config only** (no payment keys in frontend):

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

Copy Firebase project ID:

```bash
cp .firebaserc.example .firebaserc
# Edit .firebaserc → replace YOUR_FIREBASE_PROJECT_ID
```

---

## Step 4: Set Backend Secrets (3 min)

All sensitive keys stay in Firebase Secrets — never in frontend code.

```bash
npm run setup:secrets
```

Or manually:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set RAPIDAPI_KEY
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_PLAN_ID_WEEKLY
firebase functions:secrets:set RAZORPAY_PLAN_ID_MONTHLY
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

Optional multi-source job APIs (non-secret params — add to `functions/.env.YOUR_PROJECT_ID`):

```bash
# Example: functions/.env.nextoffer-ai
JOOBLE_API_KEY=your_jooble_key
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
ADMIN_EMAILS=you@example.com
ADMIN_PASSWORD=your-secure-password
```

Redeploy after adding optional keys: `firebase deploy --only functions`

**Admin dashboard** — set `ADMIN_EMAILS` and `ADMIN_PASSWORD` in the same env file, then redeploy functions. Open **`/admin`** (e.g. `https://nextoffer-ai.web.app/admin`) and sign in with email + password. This is separate from the normal Google sign-in flow.

Install function dependencies and deploy:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```

---

## Step 5: Razorpay payments (10 min)

Follow **[PAYMENTS.md](./PAYMENTS.md)** to:

1. Create Razorpay subscription plans (~₹499/week, ~₹999/month — app shows $5.99 / $9.99)
2. Add webhook → `https://us-central1-nextoffer-ai.cloudfunctions.net/razorpayWebhook`
3. Run `npm run setup:secrets` with your Razorpay keys

```bash
firebase deploy --only functions
```

---

## Step 6: Analytics (optional but recommended)

1. Set `REACT_APP_FIREBASE_MEASUREMENT_ID` in `.env.local` (from Firebase web app config).
2. For local event validation: `REACT_APP_ANALYTICS_DEBUG=true npm start`
3. Firebase Console → **Analytics → DebugView** while using the app.
4. See **[ANALYTICS.md](./ANALYTICS.md)** for events, funnels, and crash logs.

Server-side purchase tracking (webhook → GA4):

```bash
firebase functions:secrets:set GA4_API_SECRET
echo "GA4_MEASUREMENT_ID=G-XXXXXXXX" >> functions/.env.nextoffer-ai
firebase deploy --only functions
```

---

## Step 7: Run Locally

```bash
npm start
```

Open http://localhost:3000

Test flow:
1. Sign in with Google
2. Paste resume → Parse
3. Set filters → Search (JSearch + Jooble + Adzuna in parallel, deduped & ranked by resume match)
4. Generate documents → Copy
5. Upgrade with Razorpay test card `4111 1111 1111 1111`

---

## Step 8: Deploy to Production

```bash
firebase deploy --only functions
npm run deploy
```

Your app is live at `https://YOUR_PROJECT.web.app`

---

## Security Architecture

| Layer | Protection |
|-------|-----------|
| **API keys** | Firebase Secrets only — never in browser |
| **Firestore** | Rules deny all client reads/writes |
| **Auth** | Google OAuth via Firebase Auth |
| **AI & jobs** | All processing in Cloud Functions |
| **Payments** | Razorpay (INR subscriptions) + signed webhooks |
| **Rate limits** | Per-user daily caps on AI calls |
| **Headers** | CSP, X-Frame-Options, nosniff on hosting |
| **Analytics** | GA4 via Firebase Analytics; see ANALYTICS.md |
| **Crash logs** | `clientErrors` Firestore + GA4 `exception` events |
| **Resume data** | Full resume text stored in server-only Firestore (`users/{uid}/resumes`); used to tailor application documents; never sent to the browser |
| **Application kits** | Generated resume / cover letter / email saved per job in `users/{uid}/jobKits` (server-only); restored when reopening a job |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Google login fails | Add domain to Firebase Auth authorized domains |
| "Job search unavailable" | Check `RAPIDAPI_KEY` secret; verify JSearch subscription |
| Only JSearch results | Add `JOOBLE_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` to `functions/.env.*` and redeploy |
| Checkout fails | Verify Razorpay keys + Plan IDs — see PAYMENTS.md |
| Pro not unlocking | Check webhook URL + `RAZORPAY_WEBHOOK_SECRET`; payment verify runs on success |
| Functions timeout | Multi-source search + scoring can take 30–60s — already set to 120s |

---

## Project Structure

```
files/
├── public/index.html          # HTML shell
├── src/
│   ├── App.jsx                # React UI (no secret keys)
│   ├── firebase.js            # Firebase client init
│   └── theme.js               # Design tokens
├── functions/
│   ├── index.js               # Secure backend (AI, job search, Razorpay)
│   └── jobs/                  # Multi-source pipeline (JSearch, Jooble, Adzuna)
├── firestore.rules            # Deny all client DB access
├── firebase.json              # Hosting + functions config
├── .env.local.example         # Frontend env template
└── scripts/setup-secrets.sh   # One-command secret setup
```

---

You're ready to launch.
