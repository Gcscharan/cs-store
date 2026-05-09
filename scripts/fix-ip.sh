#!/usr/bin/env bash
# fix-ip.sh
# Quickly updates EXPO_PUBLIC_API_URL in apps/customer-app/.env
# to your current local IPv4. Does NOT start any server.
#
# Usage: npm run fix:ip

set -e

ENV_FILE="apps/customer-app/.env"

detect_ip() {
  for iface in en0 en1 en2 bridge0; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null)
    if [[ -n "$ip" && "$ip" != 127.* ]]; then
      echo "$ip"
      return
    fi
  done
  ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1
}

IP=$(detect_ip)

if [[ -z "$IP" ]]; then
  echo "❌  Could not detect a local IPv4 address."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  $ENV_FILE not found."
  exit 1
fi

sed -i '' "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$IP:5002/api|" "$ENV_FILE"

echo "✅  EXPO_PUBLIC_API_URL=http://$IP:5002/api"
echo ""
echo "Next steps:"
echo "  • Already have the dev build installed? → npm run dev:android:local (rebuilds with new IP)"
echo "  • Just need Metro?                      → npm run dev:mobile:local"
