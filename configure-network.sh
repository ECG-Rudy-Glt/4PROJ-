#!/bin/bash

# Script de configuration réseau pour SUPFILE
# Ce script aide à configurer l'application pour l'accès réseau local

echo "========================================="
echo "  Configuration Réseau SUPFILE"
echo "========================================="
echo ""

# Fonction pour détecter l'IP de la machine
detect_ip() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        IP=$(hostname -I | awk '{print $1}')
    else
        # Windows (Git Bash ou WSL)
        IP=$(ipconfig.exe 2>/dev/null | grep -i "IPv4" | head -n 1 | awk '{print $NF}' | tr -d '\r')
    fi
    echo "$IP"
}

echo "Détection de votre adresse IP..."
DETECTED_IP=$(detect_ip)

if [ -n "$DETECTED_IP" ]; then
    echo "✓ Adresse IP détectée : $DETECTED_IP"
    echo ""
    read -p "Utiliser cette adresse IP ? (O/n) : " USE_DETECTED

    if [[ "$USE_DETECTED" =~ ^[Nn]$ ]]; then
        read -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
        FINAL_IP="$CUSTOM_IP"
    else
        FINAL_IP="$DETECTED_IP"
    fi
else
    echo "⚠ Impossible de détecter automatiquement votre IP"
    echo ""
    read -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
    FINAL_IP="$CUSTOM_IP"
fi

echo ""
echo "Configuration avec l'IP : $FINAL_IP"
echo ""

# Mise à jour du fichier .env
if [ -f ".env" ]; then
    echo "Mise à jour du fichier .env..."

    # Backup de l'ancien fichier
    cp .env .env.backup

    # Mise à jour des variables
    sed -i.tmp "s|HOST_IP=.*|HOST_IP=$FINAL_IP|" .env
    sed -i.tmp "s|API_URL=.*|API_URL=http://$FINAL_IP:5001|" .env
    sed -i.tmp "s|FRONTEND_URL=.*|FRONTEND_URL=http://$FINAL_IP:3000|" .env

    # Nettoyage des fichiers temporaires
    rm -f .env.tmp

    echo "✓ Fichier .env mis à jour"
else
    echo "✗ Fichier .env introuvable"
    exit 1
fi

echo ""
echo "========================================="
echo "  Configuration terminée !"
echo "========================================="
echo ""
echo "Prochaines étapes :"
echo ""
echo "1. Assurez-vous que le pare-feu autorise les ports 3000 et 5001"
echo ""
echo "2. Démarrez l'application avec :"
echo "   docker compose down"
echo "   docker compose up -d --build"
echo ""
echo "3. Accédez à l'application :"
echo "   - Depuis cette machine : http://$FINAL_IP:3000"
echo "   - Depuis un autre PC du réseau : http://$FINAL_IP:3000"
echo ""
echo "Pour plus d'informations, consultez CONFIGURATION_RESEAU.md"
echo ""
