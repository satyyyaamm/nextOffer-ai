# Push to GitHub (private `nextoffer-ai`)

Repo root: **`/Users/satyyyaamm/bunny/nextOffer-ai`** (not `nextOffer/files`).

## What is never committed

- `.env.local` (Firebase keys)
- `functions/.env.nextoffer-ai` (GA4_MEASUREMENT_ID)
- `.firebaserc` (use `.firebaserc.example` in the repo)
- `node_modules/`, `build/`, `.firebase/`, `*.log`

## One-time: log in to GitHub CLI

```bash
gh auth login
```

Choose: GitHub.com → HTTPS → Login with browser.

## Create private repo and push

```bash
cd /Users/satyyyaamm/bunny/nextOffer-ai

gh repo create nextoffer-ai --private --source=. --remote=origin --push
```

If the repo name is taken on your account, use another name or add your username:

```bash
gh repo create YOUR_USERNAME/nextoffer-ai --private --source=. --remote=origin --push
```

## After clone on another machine

```bash
cp .env.local.example .env.local
cp .firebaserc.example .firebaserc
cp functions/.env.example functions/.env.nextoffer-ai
# Fill in values, then:
npm install
cd functions && npm install && cd ..
```

Firebase secrets stay in Firebase (`firebase functions:secrets:set`), not in git.
