#!/usr/bin/env bash
# Run once if Cloud Functions return "not authenticated" / empty Authorization header.
# Requires: gcloud CLI (https://cloud.google.com/sdk/docs/install)

set -euo pipefail
PROJECT="${1:-nextoffer-ai}"
REGION="us-central1"

for svc in getuserprofile parseresume searchjobs generatedocument createcheckoutsession getresumes; do
  echo "→ Granting public invoke on $svc..."
  gcloud run services add-iam-policy-binding "$svc" \
    --region="$REGION" \
    --member=allUsers \
    --role=roles/run.invoker \
    --project="$PROJECT"
done

echo "✓ Done. Restart npm start and sign in again."
