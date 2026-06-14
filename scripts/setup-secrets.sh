#!/usr/bin/env bash
# NextOffer.ai — Firebase Secrets Setup
# Run: npm run setup:secrets

set -euo pipefail

echo ""
echo "═══════════════════════════════════════════════════"
echo "  NextOffer.ai — Firebase Secrets Setup"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Get your keys from:"
echo "  • Anthropic:   https://console.anthropic.com/settings/keys"
echo "  • RapidAPI:    https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"
echo "  • Razorpay:    https://dashboard.razorpay.com/app/keys"
echo ""

read -rsp "ANTHROPIC_API_KEY: " ANTHROPIC && echo
read -rsp "RAPIDAPI_KEY: " RAPIDAPI && echo
read -rp "RAZORPAY_KEY_ID (starts with rzp_): " RZ_KEY_ID && echo
read -rsp "RAZORPAY_KEY_SECRET: " RZ_KEY_SECRET && echo
read -rsp "RAZORPAY_WEBHOOK_SECRET: " RZ_WH && echo
read -rp "RAZORPAY_PLAN_ID_WEEKLY (plan_…, ~₹499/wk, displays $5.99): " RZ_PLAN_W && echo
read -rp "RAZORPAY_PLAN_ID_MONTHLY (plan_…, ~₹999/mo, displays $9.99): " RZ_PLAN_M && echo

echo "$ANTHROPIC"      | firebase functions:secrets:set ANTHROPIC_API_KEY
echo "$RAPIDAPI"        | firebase functions:secrets:set RAPIDAPI_KEY
echo "$RZ_KEY_ID"       | firebase functions:secrets:set RAZORPAY_KEY_ID
echo "$RZ_KEY_SECRET"   | firebase functions:secrets:set RAZORPAY_KEY_SECRET
echo "$RZ_WH"           | firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
echo "$RZ_PLAN_W"       | firebase functions:secrets:set RAZORPAY_PLAN_ID_WEEKLY
echo "$RZ_PLAN_M"       | firebase functions:secrets:set RAZORPAY_PLAN_ID_MONTHLY

PROJECT_ID=$(firebase use 2>/dev/null | grep -oE '[^ ]+$' || echo "nextoffer-ai")
echo "✓ Secrets saved. Deploy:"
echo "  firebase deploy --only functions,firestore:rules"
echo ""
echo "Razorpay webhook URL (Settings → Webhooks → Add):"
echo "  https://us-central1-${PROJECT_ID}.cloudfunctions.net/razorpayWebhook"
echo ""
echo "Subscribe to: subscription.authenticated, subscription.activated,"
echo "  subscription.charged, subscription.cancelled, subscription.completed,"
echo "  subscription.halted, subscription.resumed"
echo ""
echo "See PAYMENTS.md — app shows USD; Razorpay plans in INR."
echo ""
