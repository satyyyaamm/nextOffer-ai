#!/usr/bin/env bash
# JobCraft AI — Firebase Secrets Setup
# Run: npm run setup:secrets

set -euo pipefail

echo ""
echo "═══════════════════════════════════════════════════"
echo "  NextOffer.ai — Firebase Secrets Setup"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Get your keys from:"
echo "  • Anthropic:      https://console.anthropic.com/settings/keys"
echo "  • RapidAPI:       https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"
echo "  • Lemon Squeezy:  https://app.lemonsqueezy.com/settings/api"
echo ""

read -rsp "ANTHROPIC_API_KEY: " ANTHROPIC && echo
read -rsp "RAPIDAPI_KEY: " RAPIDAPI && echo
read -rsp "LEMONSQUEEZY_API_KEY: " LS_KEY && echo
read -rsp "LEMONSQUEEZY_WEBHOOK_SECRET (signing secret from webhook): " LS_WH && echo
read -rp "LEMONSQUEEZY_STORE_ID (numeric): " LS_STORE && echo
read -rp "LEMONSQUEEZY_VARIANT_ID_WEEKLY ($5.99/wk variant): " LS_VARIANT_W && echo
read -rp "LEMONSQUEEZY_VARIANT_ID_MONTHLY ($9.99/mo variant): " LS_VARIANT_M && echo
read -rp "FRONTEND_URL (e.g. https://nextoffer-ai.web.app): " FRONTEND && echo

echo "$ANTHROPIC"   | firebase functions:secrets:set ANTHROPIC_API_KEY
echo "$RAPIDAPI"     | firebase functions:secrets:set RAPIDAPI_KEY
echo "$LS_KEY"       | firebase functions:secrets:set LEMONSQUEEZY_API_KEY
echo "$LS_WH"        | firebase functions:secrets:set LEMONSQUEEZY_WEBHOOK_SECRET
echo "$LS_STORE"     | firebase functions:secrets:set LEMONSQUEEZY_STORE_ID
echo "$LS_VARIANT_W" | firebase functions:secrets:set LEMONSQUEEZY_VARIANT_ID_WEEKLY
echo "$LS_VARIANT_M" | firebase functions:secrets:set LEMONSQUEEZY_VARIANT_ID_MONTHLY

PROJECT_ID=$(firebase use 2>/dev/null | grep -oE '[^ ]+$' || echo "nextoffer-ai")
echo "FRONTEND_URL=$FRONTEND" > "functions/.env.$PROJECT_ID"
echo "✓ Saved FRONTEND_URL to functions/.env.$PROJECT_ID"

echo ""
echo "✓ Secrets saved. Deploy:"
echo "  firebase deploy --only functions,firestore:rules"
echo ""
echo "Lemon Squeezy webhook URL (Settings → Webhooks → Add):"
echo "  https://us-central1-${PROJECT_ID}.cloudfunctions.net/lemonSqueezyWebhook"
echo ""
echo "Subscribe to events:"
echo "  subscription_created, subscription_updated,"
echo "  subscription_cancelled, subscription_expired,"
echo "  subscription_payment_success"
echo ""
echo "See PAYMENTS.md for Weekly ($5.99) and Monthly ($9.99) products."
echo ""
