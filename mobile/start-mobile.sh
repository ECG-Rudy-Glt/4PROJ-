#!/bin/bash
# Détecte l'IP locale et lance Expo Go avec la bonne config réseau

IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

if [ -z "$IP" ]; then
  echo "❌ Impossible de détecter l'IP locale"
  exit 1
fi

echo "🌐 IP détectée : $IP"

# Met à jour le .env mobile
echo "EXPO_PUBLIC_API_URL=http://$IP:5001/api" > "$(dirname "$0")/.env"
echo "✅ .env mis à jour : EXPO_PUBLIC_API_URL=http://$IP:5001/api"

# Lance Expo avec la bonne IP pour Metro
echo "🚀 Lancement d'Expo..."
REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo start --clear
