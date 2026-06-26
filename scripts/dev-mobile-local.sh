#!/usr/bin/env bash
# dev-mobile-local.sh
# Auto-detects your current local IPv4, updates apps/customer-app/.env,
# then starts Expo (Metro only — use for dev builds already installed).
#
# Usage:
#   npm run dev:mobile:local          → update IP + start Metro
#   npm run dev:mobile:local android  → update IP + full native rebuild

set -e

ENV_FILE="apps/customer-app/.env"
MODE="${1:-metro}"  # "metro" or "android"

# ── Detect current IPv4 ───────────────────────────────────────────────────────
detect_ip() {
  for iface in en0 en1 en2 bridge0; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null)
    if [[ -n "$ip" && "$ip" != 127.* ]]; then
      echo "$ip"
      return
    fi
  done
  # Fallback: first non-loopback IPv4 from ifconfig
  ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1
}

IP=$(detect_ip)

if [[ -z "$IP" ]]; then
  echo "❌  Could not detect a local IPv4 address."
  echo "    Make sure you are connected to WiFi or a hotspot."
  exit 1
fi

echo "🌐  Detected local IP: $IP"

# ── Patch EXPO_PUBLIC_API_URL in .env ─────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  $ENV_FILE not found."
  exit 1
fi

sed -i '' "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$IP:5001/api|" "$ENV_FILE"

echo "✅  Updated $ENV_FILE → EXPO_PUBLIC_API_URL=http://$IP:5001/api"
echo ""

# ── Remind about Atlas whitelist ──────────────────────────────────────────────
echo "📋  If MongoDB Atlas is rejecting connections, whitelist your public IP:"
echo "    $(curl -s -4 --max-time 3 ifconfig.me 2>/dev/null || echo '(could not fetch — run: curl -4 ifconfig.me)')"
echo "    https://cloud.mongodb.com → Network Access → Add IP Address"
echo ""

# ── Start Expo ────────────────────────────────────────────────────────────────
if [[ "$MODE" == "android" ]]; then
  echo "🚀  Building and launching on Android (this will take a minute)..."
  cd apps/customer-app && npx expo run:android
else
  echo "🚀  Starting Metro (use with an already-installed dev build)..."
  cd apps/customer-app && npx expo start
fi
