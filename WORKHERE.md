# Use this folder (not `nextOffer/files`)

This is the **active** project root for NextOffer.ai.

## Firebase connection

| File | Purpose |
|------|---------|
| `.firebaserc` | Firebase project `nextoffer-ai` |
| `.env.local` | Web app config (from Firebase Console) |
| `functions/.env.nextoffer-ai` | `GA4_MEASUREMENT_ID` for server-side analytics (optional) |

Firebase CLI login is **global** — same account works here after `firebase login`.

## Commands (run from this folder)

```bash
cd /Users/satyyyaamm/bunny/nextOffer-ai

npm start                    # local app
npm run build                # production build
firebase deploy --only hosting
firebase deploy --only functions
```

## Cursor / VS Code

**File → Open Folder** → choose `/Users/satyyyaamm/bunny/nextOffer-ai`

Do not keep editing `bunny/nextOffer/files` — that copy is outdated.

## Secrets

- Never commit `.env.local` or `functions/.env.nextoffer-ai`
- API keys for Anthropic, RapidAPI, Razorpay, GA4 API secret → Firebase Secrets only
