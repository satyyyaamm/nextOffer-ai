# Payments — NextOffer.ai (Lemon Squeezy)

Two Pro plans in USD. Checkout and webhooks run on Firebase only (no payment keys in the browser).

## Plans

| Plan | Price | Lemon Squeezy setup |
|------|--------|---------------------|
| **Weekly Sprint** | $5.99 / week | Subscription, billed every 1 week |
| **Monthly Pro** | $9.99 / month | Subscription, billed every 1 month |

Both unlock `tier: "pro"` in Firestore via the same webhook.

---

## What you need from Lemon Squeezy

After creating both products, copy these **numeric IDs**:

| ID | Where to find it |
|----|------------------|
| **Store ID** | Settings → Store |
| **Weekly variant ID** | Weekly product → variant (price) → ID in URL or API |
| **Monthly variant ID** | Monthly product → variant → ID |
| **API key** | Settings → API |
| **Webhook signing secret** | Settings → Webhooks → your webhook |

---

## Firebase secrets

Set all of these (project: `nextoffer-ai`):

```bash
firebase functions:secrets:set LEMONSQUEEZY_API_KEY
firebase functions:secrets:set LEMONSQUEEZY_STORE_ID
firebase functions:secrets:set LEMONSQUEEZY_VARIANT_ID_WEEKLY
firebase functions:secrets:set LEMONSQUEEZY_VARIANT_ID_MONTHLY
firebase functions:secrets:set LEMONSQUEEZY_WEBHOOK_SECRET
```

`FRONTEND_URL` in `functions/.env.nextoffer-ai`:

```
FRONTEND_URL=https://nextoffer-ai.web.app
```

Or run:

```bash
npm run setup:secrets
```

**Note:** The old single secret `LEMONSQUEEZY_VARIANT_ID` is no longer used. Set the two variant secrets above.

---

## Webhook

1. **Settings → Webhooks → Add webhook**
2. **URL:**
   ```
   https://us-central1-nextoffer-ai.cloudfunctions.net/lemonSqueezyWebhook
   ```
3. **Events:** `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_payment_success`
4. Save the **signing secret** as `LEMONSQUEEZY_WEBHOOK_SECRET`

---

## Deploy

```bash
firebase deploy --only functions:createCheckoutSession,functions:lemonSqueezyWebhook
npm run deploy:hosting
```

---

## Test

1. Lemon Squeezy **Test mode** on  
2. App → Upgrade → pick **Weekly** or **Monthly** → complete test checkout  
3. Return to `https://nextoffer-ai.web.app?checkout=success`  
4. Firestore: `users/{uid}.tier` = `"pro"`  
5. Repeat for the other plan  

---

## Go live

1. Turn off Test mode (or use live variants)  
2. Update secrets with **live** API key + variant IDs if they differ  
3. Redeploy functions  
