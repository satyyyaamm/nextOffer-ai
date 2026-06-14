# Payments — NextOffer.ai (Razorpay)

Pro subscriptions via Razorpay. **The app displays USD ($5.99 / $9.99)** — Razorpay plans are set up in **INR** at an equivalent amount (see below).

## Plans

| Plan | **Shown in app (USD)** | **Razorpay plan (INR)** |
|------|------------------------|-------------------------|
| **Weekly Sprint** | **$5.99 / week** | ~**₹499** / week (you choose exact INR) |
| **Monthly Pro** | **$9.99 / month** | ~**₹999** / month (you choose exact INR) |

Both unlock `tier: "pro"` in Firestore. Users always see **USD** in the UI; Razorpay checkout shows the INR charge.

---

## Razorpay Dashboard — step by step

### 1. Activate your account
- [Razorpay Dashboard](https://dashboard.razorpay.com/) → complete KYC if not done
- Switch to **Live mode** when ready (use **Test mode** first)

### 2. Get API keys
**Settings → API Keys → Generate Key**
- Copy **Key ID** → `RAZORPAY_KEY_ID`
- Copy **Key Secret** → `RAZORPAY_KEY_SECRET`

Use **Test** keys while developing; swap to **Live** keys before launch.

### 3. Create subscription plans
**Subscriptions → Plans → Create Plan**

**Weekly plan** (≈ $5.99/week in app)
- Billing amount: **₹499** (or your preferred INR equivalent)
- Billing interval: **Weekly**
- Billing cycle: every **1** week
- Copy **Plan ID** (starts with `plan_`) → `RAZORPAY_PLAN_ID_WEEKLY`

**Monthly plan** (≈ $9.99/month in app)
- Billing amount: **₹999** (or your preferred INR equivalent)
- Billing interval: **Monthly**
- Billing cycle: every **1** month
- Copy **Plan ID** → `RAZORPAY_PLAN_ID_MONTHLY`

> App UI always shows **USD**. Razorpay must charge **INR** (Indian merchant accounts). Keep INR amounts roughly aligned with $5.99 / $9.99.

### 4. Enable Subscriptions
**Settings → Subscriptions** — ensure subscriptions are enabled for your account.

### 5. Webhook
**Settings → Webhooks → + Add New Webhook**

**URL** (replace `YOUR_PROJECT_ID`):
```
https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/razorpayWebhook
```

Example for this project:
```
https://us-central1-nextoffer-ai.cloudfunctions.net/razorpayWebhook
```

**Active events** (minimum):
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.halted`
- `subscription.resumed`

Copy the **Webhook Secret** → `RAZORPAY_WEBHOOK_SECRET`

---

## Firebase secrets

```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_PLAN_ID_WEEKLY
firebase functions:secrets:set RAZORPAY_PLAN_ID_MONTHLY
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

Or run:
```bash
npm run setup:secrets
```

---

## Deploy

```bash
firebase deploy --only functions:createCheckoutSession,functions:verifyRazorpaySubscription,functions:razorpayWebhook
npm run deploy:hosting
```

---

## How checkout works

1. User clicks **Upgrade** → app calls `createCheckoutSession`
2. Backend creates a Razorpay **subscription** and returns `keyId` + `subscriptionId`
3. Razorpay checkout modal opens (UPI / card / netbanking)
4. On success, app calls `verifyRazorpaySubscription` → instant Pro unlock
5. Razorpay webhook confirms / renews / cancels in the background

---

## Test (Test mode)

1. Use **Test** API keys and test plans in Razorpay
2. App → Upgrade → pick Weekly or Monthly
3. Razorpay test card: `4111 1111 1111 1111`, any future expiry, any CVV
4. Firestore: `users/{uid}.tier` = `"pro"`
5. Test webhook with Razorpay **Send test webhook** on your webhook URL

---

## Go live

1. Create **Live** plans (INR ~₹499 weekly, ~₹999 monthly — USD display stays $5.99 / $9.99)
2. Set **Live** API keys + Live plan IDs + Live webhook secret
3. Redeploy functions
4. Run one real ₹1 test subscription if Razorpay offers it, then cancel

---

## Cancel subscriptions

Users cancel via **Razorpay Dashboard → Subscriptions** (merchant view) or you can cancel from the dashboard when they email support.

When Razorpay sends `subscription.cancelled`, the app sets `tier: "free"`.

Support: **ranurainfotech@gmail.com**