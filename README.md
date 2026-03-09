# Binance Grid Bot Dashboard

Dashboard Angular pour suivre les profits de vos Grid Bots Binance en temps réel.

## Fonctionnalités

- 📊 Affichage des taux de change BTC, ETH, BNB, USDT en EUR
- 📋 Copier/coller les données depuis la page Binance Grid Bot
- 💰 Calcul automatique des profits en EUR et USDC
- ⚙️ Configuration des profits des bots fermés (avec synchronisation EUR/USDC)
- 🔄 Actualisation automatique des taux de change (toutes les 30s)

## Développement local

### Backend (API)

Le backend est un serveur Express qui récupère les taux de change depuis l'API Binance et gère la persistance des données avec SQLite.

```bash
# Aller dans le dossier backend
cd backend

# Installation des dépendances
npm install

# Démarrer le serveur backend (port 3000)
npm start
```

Le backend sera accessible sur http://localhost:3000

**Variables d'environnement :**

- `PORT` : Port du serveur (défaut: `3000`)
- `MODE` : `mock` pour les données simulées, `live` pour l'API Binance réelle (défaut: `mock`)

```bash
# Exemple : démarrer en mode live sur le port 3001
MODE=live PORT=3001 npm start
```

### Frontend (Angular)

```bash
# Revenir à la racine du projet
cd ..

# Installation des dépendances
npm install

# Démarrer le serveur de développement (port 4201)
npm start
```

Ouvrez http://localhost:4201 dans votre navigateur.

### Démarrer les deux serveurs

Pour le développement, vous devez lancer les deux serveurs dans des terminaux séparés :

```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
npm start
```

## Build de production

```bash
npm run build
```

Les fichiers de production seront générés dans `dist/binance-bot-app/browser`.

## Docker

### Build et exécution avec Docker Compose

```bash
# Build et démarrage
docker-compose up -d --build

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

L'application sera accessible sur http://localhost:4201

### Build manuel Docker

```bash
# Build de l'image
docker build -t binance-bot-app .

# Exécution
docker run -d -p 4201:4201 --name binance-bot binance-bot-app
```

## Installation Home Assistant (Hassio)

### Méthode 1: Add-on local

1. Copiez le dossier `hassio-addon` dans `/addons/binance-bot-dashboard` sur votre instance Home Assistant
2. Allez dans Supervisor > Add-on Store > Bouton "..." > Check for updates
3. L'add-on "Binance Grid Bot Dashboard" devrait apparaître dans "Local add-ons"
4. Installez et démarrez l'add-on
5. Accédez via http://homeassistant.local:4201 ou via la barre latérale

### Méthode 2: Container Docker standalone

Sur votre machine Home Assistant (via SSH) :

```bash
# Cloner le repo ou copier les fichiers
cd /config
mkdir binance-bot && cd binance-bot

# Copier les fichiers du projet ici, puis:
docker-compose up -d --build
```

## Structure des données

L'application stocke les données dans le localStorage du navigateur :

- `closed_bots_config` : Configuration des profits des bots fermés
- `bot_data_text` : Dernières données collées

## API Binance

L'application utilise l'API publique Binance pour récupérer les taux de change :

- `BTCUSDT`, `ETHUSDT`, `BNBUSDT`, `EURUSDT`

Un proxy nginx est configuré pour éviter les problèmes CORS.
