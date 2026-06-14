# NextOffer.ai — Analytics & crash reporting

Product analytics uses **Firebase Analytics (GA4)**. Web crash reporting uses **GA4 `exception` events** plus durable logs in Firestore (`clientErrors`), because native **Firebase Crashlytics is not available for JavaScript web apps**.

## Setup

### 1. Enable Analytics

1. Firebase Console → **Analytics** → enable / link GA4.
2. Project Settings → Your web app → copy **Measurement ID** (`G-XXXXXXXX`).
3. Add to `.env.local`:

```bash
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

4. Rebuild and deploy hosting (`npm run build && firebase deploy --only hosting`).

### 2. DebugView (local testing)

1. Install the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) Chrome extension (or use GA4 DebugView with a debug device).
2. Optional: `REACT_APP_ANALYTICS_DEBUG=true` logs events to the browser console.
3. Run `npm start` and open Firebase Console → **Analytics → DebugView**.
4. Trigger flows: landing, sign-in, upload, search, generate.

### 3. Server-side purchase events (optional)

Backup revenue tracking when the browser closes before client events fire. The backend sends `purchase_success` via GA4 Measurement Protocol on:

- `verifyRazorpaySubscription` (immediate payment success)
- `razorpayWebhook` (`subscription.activated`, `subscription.charged`, renewals)

```bash
firebase functions:secrets:set GA4_API_SECRET
```

In `functions/.env.nextoffer-ai`:

```bash
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

Redeploy functions after setting secrets. Client-side Firebase Analytics also fires `purchase_success` when checkout completes in-app (primary path for the monetization funnel).

### 4. Mark conversions in GA4

Admin → **Events** → mark as conversions:

- `sign_in_success`
- `resume_upload_success`
- `search_success`
- `doc_generate_success`
- `purchase_success`

## Event dictionary

| Event | Params | Use |
|-------|--------|-----|
| `app_open` | — | Once per browser session |
| `landing_view` | `referrer_host` | Top of funnel |
| `cta_click` | `location` (`hero`) | CTA engagement |
| `sign_in_start` | `method` | Auth intent |
| `sign_in_success` | `method`, `is_new_user` (0/1) | Sign-up / login |
| `sign_in_failure` | `error_code` | Auth friction |
| `returning_user` | — | Once per session if user had prior activity |
| `screen_view` | `screen` | In-app navigation |
| `resume_upload_start` | — | Activation start |
| `resume_upload_success` | `has_profile_fields` | Activation complete |
| `resume_upload_failure` | `error_code` | Parse/upload issues |
| `search_start` | — | Core feature intent |
| `search_success` | `job_count`, `top_match_bucket` | Value delivered |
| `search_empty` | `reason` | Product gap (filters / API) |
| `search_failure` | `error_code` | Reliability |
| `job_open` | `match_bucket` | Listing engagement |
| `doc_generate_start` | `doc_type` | Kit usage |
| `doc_generate_success` | `doc_type` | **Core value** |
| `doc_generate_failure` | `doc_type`, `error_code` | Generation issues |
| `doc_regenerate` | `doc_type` | Pro usage |
| `kit_library_open` | `kit_count` | Retention / return visits |
| `upgrade_modal_view` | `reason` (`search`/`upload`/`kit`/`generic`) | **Where users hit limits** |
| `upgrade_click` | `plan` | Pricing choice |
| `checkout_start` | `plan` | Razorpay checkout modal opened |
| `checkout_return` | `status`, `plan` | Razorpay payment succeeded in-app |
| `free_limit_reached` | `action` | Free tier ceiling |
| `purchase_success` | `plan`, `value`, `currency` | Revenue — client on success; server on verify + webhook renewals |
| `api_call_failure` | `function_name`, `error_code` | Backend/API health |
| `exception` | `description`, `fatal`, `context` | Crashes & errors |

**User properties:** `tier`, `has_resume`, `kits_saved`, `signup_week`

No resume text, job titles, or emails are sent in event params.

## Reports to build in GA4

### Retention

Explorations → **Retention** → cohort by user property `signup_week` or first `sign_in_success`.

### Activation funnel

Funnel steps:

1. `landing_view`
2. `sign_in_success`
3. `resume_upload_success`
4. `search_success`
5. `doc_generate_success`

### Monetization funnel

1. `upgrade_modal_view` (break down by `reason`)
2. `upgrade_click`
3. `checkout_start`
4. `purchase_success`

### Where the product lags

- High `search_empty` rate → filters too strict or job API coverage.
- `upgrade_modal_view` by `reason` → which free limit hurts most (`search`, `upload`, `kit`).
- `doc_generate_failure` / `api_call_failure` → reliability.
- `sign_in_failure` → auth/domain issues.

## Crash logs (Firestore)

Client errors are stored in `clientErrors` (admin-only). View in Firebase Console → Firestore.

Fields: `uid`, `message`, `stack`, `source`, `screen`, `action`, `url`, `userAgent`, `fatal`, `createdAt`.

Rate limit: 30 logs per user per hour.

## Code map

| File | Role |
|------|------|
| [`src/analytics.js`](src/analytics.js) | `track`, `identifyUser`, `trackScreen`, `trackException` |
| [`src/crashReporting.js`](src/crashReporting.js) | Global handlers + `reportError` |
| [`src/firebase.js`](src/firebase.js) | Analytics singleton |
| [`functions/index.js`](functions/index.js) | `logClientError`, GA4 Measurement Protocol on webhook |
