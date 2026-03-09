# Guide d'installation sur Home Assistant (Hassio)

## Prérequis

- Home Assistant OS ou Supervised
- Accès à votre instance Home Assistant (Samba share ou SSH)
- Add-on "Samba share" installé (recommandé)

---

## Architecture

L'add-on se compose de :

- **Frontend Angular** : Interface web servie par nginx sur le port 4201
- **Backend Node.js** : API qui appelle Binance (évite les problèmes CORS)
- **Supervisor** : Gère nginx et Node.js

---

## Installation rapide (Recommandée)

### Étape 1 : Construire le package

Sur votre PC Windows, ouvrez PowerShell et exécutez :

```powershell
cd d:\dev\perso\binance-bot\binance-bot-app
.\build-hassio.ps1
```

Ce script va :

1. Builder l'application Angular
2. Préparer le dossier `deploy-hassio/` avec tous les fichiers nécessaires

### Étape 2 : Copier vers Home Assistant

#### Méthode A : Via Samba Share (Recommandé) ⭐

1. Installez l'add-on **"Samba share"** depuis la boutique d'add-ons HA
2. Configurez un utilisateur/mot de passe et démarrez-le
3. Depuis Windows, ouvrez l'Explorateur de fichiers et allez à : `\\homeassistant.local\addons\`
4. Créez un nouveau dossier `binance-bot-dashboard`
5. Copiez **tout le contenu** de `deploy-hassio\` dans ce dossier

Structure finale sur HA :

```
/addons/binance-bot-dashboard/
├── backend/
│   ├── package.json
│   └── server.js
├── www/
│   ├── index.html
│   └── ... (fichiers Angular)
├── config.json
├── Dockerfile
├── nginx.conf
├── run.sh
└── supervisord.ini
```

#### Méthode B : Via SCP (SSH)

```powershell
# Depuis le dossier binance-bot-app
scp -r deploy-hassio/* root@homeassistant.local:/addons/binance-bot-dashboard/
```

### Étape 3 : Installer l'add-on dans Home Assistant

1. Dans Home Assistant, allez dans **Paramètres > Modules complémentaires**
2. Cliquez sur **Boutique des modules complémentaires** (bouton en bas à droite)
3. Cliquez sur les **3 points** en haut à droite > **Vérifier les mises à jour**
4. Retournez sur la page des add-ons
5. Vous devriez voir **"Binance Grid Bot Dashboard"** dans la section **"Local add-ons"**
6. Cliquez dessus et cliquez sur **Installer**

### Étape 4 : Configurer l'add-on

1. Allez dans l'onglet **Configuration** de l'add-on
2. Configurez les options :

```yaml
binance_api_key: '' # Optionnel - pas utilisé actuellement
binance_secret_key: '' # Optionnel - pas utilisé actuellement
mode: 'live' # "live" = appelle Binance API, "mock" = données de test
password: 'votre_mot_de_passe' # Optionnel - laissez vide pour désactiver
```

3. Cliquez sur **Sauvegarder**

### Étape 5 : Démarrer et accéder

1. Cliquez sur **Démarrer**
2. Attendez que l'add-on soit en cours d'exécution (vert)
3. Accédez au dashboard via :
   - http://homeassistant.local:4201
   - Ou activez "Afficher dans la barre latérale" pour un accès direct

---

## Options de configuration

| Option               | Description                         | Valeurs          | Défaut |
| -------------------- | ----------------------------------- | ---------------- | ------ |
| `mode`               | Mode de fonctionnement              | `live` ou `mock` | `live` |
| `password`           | Mot de passe pour protéger l'accès  | texte ou vide    | vide   |
| `binance_api_key`    | Clé API Binance (réservé futur)     | texte            | vide   |
| `binance_secret_key` | Clé secrète Binance (réservé futur) | texte            | vide   |

### Mode Live vs Mock

- **`live`** : Le backend appelle l'API Binance pour obtenir les vrais taux de change
- **`mock`** : Le backend retourne des données de test (utile pour tester sans accès internet)

---

## Mise à jour de l'add-on

1. Reconstruisez le package :

   ```powershell
   .\build-hassio.ps1
   ```

2. Recopiez les fichiers vers `/addons/binance-bot-dashboard/` (via Samba)

3. Dans Home Assistant, allez dans l'add-on et cliquez sur **Reconstruire**

---

## Dépannage

### L'add-on ne démarre pas

1. Vérifiez les logs : **Paramètres > Modules complémentaires > Binance Bot > Journal**
2. Erreurs courantes :
   - `exec format error` : Le fichier `run.sh` a des fins de ligne Windows (CRLF). Convertissez en LF.
   - Port 4201 déjà utilisé

### Les taux de change ne se chargent pas

1. Vérifiez que le mode est sur `live` (pas `mock`)
2. Vérifiez que Home Assistant a accès à Internet
3. Consultez les logs pour voir les erreurs du backend

### Conversion CRLF vers LF (si nécessaire)

Si vous avez des erreurs `exec format error`, convertissez les fins de ligne :

```powershell
# Option 1 : Avec Git
cd deploy-hassio
git config core.autocrlf false
# Puis re-générez avec build-hassio.ps1

# Option 2 : Avec dos2unix sur Linux/HA
dos2unix /addons/binance-bot-dashboard/run.sh
```

### Le dashboard affiche "Erreur de chargement"

1. Vérifiez que le backend fonctionne : accédez à `http://homeassistant.local:4201/api/health`
2. Vous devriez voir : `{"status":"ok","mode":"live",...}`

---

## Pas besoin de GitHub !

**Important** : Vous n'avez **PAS besoin** de pousser votre code sur GitHub pour installer cet add-on. L'installation se fait en copiant les fichiers localement vers Home Assistant via Samba ou SCP.

GitHub serait utile uniquement si vous vouliez :

- Partager l'add-on publiquement
- Utiliser une image Docker pré-construite
- Bénéficier de mises à jour automatiques

Pour un usage personnel, la méthode locale (Samba) est parfaite !
