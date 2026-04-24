#!/bin/bash
set -euo pipefail

# Se placer à la racine du projet
cd "$(dirname "$0")/.."

echo "========================================="
echo "  Configuration Réseau SUPFILE"
echo "========================================="
echo ""

detect_ip() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    hostname -I | awk '{print $1}'
  else
    ipconfig.exe 2>/dev/null | grep -i "IPv4" | head -n 1 | awk '{print $NF}' | tr -d '\r'
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"

  if grep -qE "^${key}=" .env; then
    sed -i.tmp "s|^${key}=.*|${key}=${value}|" .env
  else
    printf "\n%s=%s\n" "$key" "$value" >> .env
  fi
}

echo "Détection de votre adresse IP..."
DETECTED_IP="$(detect_ip || true)"

if [ -n "$DETECTED_IP" ]; then
  echo "✓ Adresse IP détectée : $DETECTED_IP"
  echo ""
  read -r -p "Utiliser cette adresse IP ? (O/n) : " USE_DETECTED

  if [[ "$USE_DETECTED" =~ ^[Nn]$ ]]; then
    read -r -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
    FINAL_IP="$CUSTOM_IP"
  else
    FINAL_IP="$DETECTED_IP"
  fi
else
  echo "⚠ Impossible de détecter automatiquement votre IP"
  echo ""
  read -r -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
  FINAL_IP="$CUSTOM_IP"
fi

echo ""
echo "Configuration avec l'IP : $FINAL_IP"
echo ""

if [ -f ".env" ]; then
  echo "Mise à jour du fichier .env..."
  cp .env .env.backup

  set_env_value "HOST_IP" "$FINAL_IP"
  set_env_value "API_URL" "http://$FINAL_IP:5001"
  set_env_value "FRONTEND_URL" "http://$FINAL_IP:3000"
  set_env_value "ONLYOFFICE_PUBLIC_URL" "http://$FINAL_IP:8080"
  set_env_value "VITE_API_URL" "http://$FINAL_IP:5001"

  rm -f .env.tmp
  echo "✓ Fichier .env mis à jour"
else
  echo "✗ Fichier .env introuvable"
  echo "  Pour le dev, lancez ./scripts/hot-start.sh pour créer .env depuis .env.example."
  exit 1
fi

echo ""
echo "========================================="
echo "  Configuration terminée !"
echo "========================================="
echo ""
echo "Prochaines étapes :"
echo ""
echo "1. Assurez-vous que le pare-feu autorise les ports 3000, 5001 et 8080"
echo ""
echo "2. Démarrez l'application :"
echo "   Dev hot reload : ./scripts/hot-start.sh"
echo "   Prod locale    : ./scripts/START.sh"
echo ""
echo "3. Accédez à l'application :"
echo "   - Depuis cette machine : http://$FINAL_IP:3000"
echo "   - Depuis un autre PC du réseau : http://$FINAL_IP:3000"
echo ""
echo "4. OnlyOffice sera accessible sur : http://$FINAL_IP:8080"
echo ""
