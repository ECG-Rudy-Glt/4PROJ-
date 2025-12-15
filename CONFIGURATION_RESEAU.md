# Configuration pour l'Accès Réseau Local

Ce guide vous explique comment configurer SUPFILE pour permettre l'accès depuis d'autres ordinateurs sur le même réseau local.

## 📋 Prérequis

- Docker et Docker Compose installés
- Tous les ordinateurs doivent être sur le même réseau local (WiFi/Ethernet)
- Le pare-feu de la machine hôte doit autoriser les connexions sur les ports 3000 et 5001

## 🔍 Étape 1 : Trouver l'adresse IP de votre machine

### Windows
1. Ouvrez l'invite de commande (`cmd`)
2. Tapez `ipconfig`
3. Cherchez l'adresse IPv4 sous "Carte réseau sans fil WiFi" ou "Carte Ethernet"
   - Exemple : `192.168.1.100`

### Mac
1. Ouvrez le Terminal
2. Tapez `ifconfig | grep "inet "`
3. Cherchez l'adresse IP qui commence par 192.168 ou 10.0
   - Exemple : `inet 192.168.1.100`

### Linux
1. Ouvrez le Terminal
2. Tapez `ip addr show` ou `ifconfig`
3. Cherchez l'adresse inet sous votre interface réseau (souvent eth0 ou wlan0)
   - Exemple : `inet 192.168.1.100/24`

## ⚙️ Étape 2 : Configurer les variables d'environnement

Éditez le fichier `.env` à la racine du projet :

```bash
# Remplacez localhost par votre adresse IP
HOST_IP=192.168.1.100

# Les autres variables seront automatiquement configurées
API_URL=http://${HOST_IP}:5001
FRONTEND_URL=http://${HOST_IP}:3000
```

**Important** : Remplacez `192.168.1.100` par votre adresse IP réelle trouvée à l'étape 1.

## 🔥 Étape 3 : Configurer le pare-feu

### Windows
1. Ouvrez "Pare-feu Windows Defender avec fonctions avancées de sécurité"
2. Cliquez sur "Règles de trafic entrant"
3. Créez deux nouvelles règles :
   - Port 3000 (Frontend)
   - Port 5001 (Backend API)
4. Autorisez les connexions pour le réseau privé

### Mac
```bash
# Autorisez les connexions sur les ports nécessaires
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/docker
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/bin/docker
```

### Linux (ufw)
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5001/tcp
sudo ufw reload
```

## 🚀 Étape 4 : Démarrer l'application

```bash
# Arrêtez l'application si elle est en cours d'exécution
docker compose down

# Reconstruisez et démarrez avec la nouvelle configuration
docker compose up -d --build
```

## 🌐 Étape 5 : Accéder depuis un autre PC

Sur n'importe quel ordinateur du même réseau :

1. Ouvrez un navigateur web
2. Allez à l'adresse : `http://VOTRE_IP:3000`
   - Exemple : `http://192.168.1.100:3000`

## ✅ Vérification

Pour vérifier que tout fonctionne :

1. Sur la machine hôte, testez :
   - Frontend : `http://localhost:3000` ou `http://VOTRE_IP:3000`
   - Backend : `http://localhost:5001/health` ou `http://VOTRE_IP:5001/health`

2. Sur un autre PC du réseau :
   - Frontend : `http://VOTRE_IP:3000`
   - Backend : `http://VOTRE_IP:5001/health`

## 🔧 Dépannage

### L'application n'est pas accessible depuis un autre PC

1. **Vérifiez l'adresse IP** : Assurez-vous d'utiliser la bonne adresse IP
2. **Vérifiez le pare-feu** : Assurez-vous que les ports 3000 et 5001 sont autorisés
3. **Vérifiez le réseau** : Les deux ordinateurs doivent être sur le même réseau
4. **Vérifiez les containers** : `docker compose ps` pour voir si tous les services sont en cours d'exécution
5. **Consultez les logs** : `docker compose logs -f` pour voir les erreurs éventuelles

### Erreurs CORS

Si vous voyez des erreurs CORS dans la console du navigateur :

1. Vérifiez que la variable `FRONTEND_URL` dans le fichier `.env` contient l'URL correcte
2. Redémarrez les containers : `docker compose restart backend`

### L'IP change à chaque redémarrage

Si votre IP change fréquemment :

1. Configurez une IP statique dans les paramètres réseau de votre système d'exploitation
2. Ou configurez une réservation DHCP dans votre routeur pour cette machine

## 📱 Configuration pour plusieurs appareils

Si vous souhaitez autoriser plusieurs appareils à accéder à l'application, ajoutez toutes les IPs dans `FRONTEND_URL` :

```bash
FRONTEND_URL=http://192.168.1.100:3000,http://192.168.1.101:3000,http://192.168.1.102:3000
```

## 🔒 Sécurité

**Important** : Cette configuration est conçue pour un réseau local de confiance uniquement.

Pour une utilisation en production sur Internet :
- Configurez HTTPS avec des certificats SSL
- Utilisez un reverse proxy (nginx, traefik)
- Configurez des règles de pare-feu strictes
- Changez les mots de passe par défaut
- Activez l'authentification à deux facteurs

## 💡 Conseils

1. **IP fixe** : Configurez une adresse IP statique pour la machine hôte pour éviter de reconfigurer à chaque redémarrage
2. **Performance** : Pour de meilleures performances, utilisez une connexion Ethernet plutôt que WiFi
3. **Sauvegarde** : Sauvegardez régulièrement le volume Docker contenant vos fichiers : `docker volume inspect supfile_uploads_data`
