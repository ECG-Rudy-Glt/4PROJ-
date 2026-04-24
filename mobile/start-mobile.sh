#!/bin/bash
set -euo pipefail

# Détecte l'IP locale et lance Expo Go avec la bonne config réseau.

detect_ip() {
  if command -v hostname > /dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
    return
  fi

  if command -v ifconfig > /dev/null 2>&1; then
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1
    return
  fi

  ipconfig.exe 2>/dev/null | grep -i "IPv4" | head -n 1 | awk '{print $NF}' | tr -d '\r'
}

IP="$(detect_ip || true)"

if [ -z "$IP" ]; then
  echo "❌ Impossible de détecter l'IP locale"
  exit 1
fi

echo "🌐 IP détectée : $IP"

echo "EXPO_PUBLIC_API_URL=http://$IP:5001/api" > "$(dirname "$0")/.env"
echo "✅ .env mis à jour : EXPO_PUBLIC_API_URL=http://$IP:5001/api"

echo "🚀 Lancement d'Expo..."
REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo start --clear
