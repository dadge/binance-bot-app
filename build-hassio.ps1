# Script de préparation du package pour Home Assistant
# Usage: .\build-hassio.ps1

Write-Host "=== Build Binance Bot Dashboard pour Hassio ===" -ForegroundColor Cyan

# 1. Build Angular
Write-Host "`n[1/3] Build de l'application Angular..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du build Angular" -ForegroundColor Red
    exit 1
}

# 2. Copier les fichiers Angular vers hassio-addon
Write-Host "`n[2/3] Copie des fichiers Angular vers hassio-addon..." -ForegroundColor Yellow
$deployDir = "hassio-addon"

# Supprimer et recréer le dossier www
if (Test-Path "$deployDir\www") {
    Remove-Item -Recurse -Force "$deployDir\www"
}
New-Item -ItemType Directory -Path "$deployDir\www" | Out-Null

# Copier les fichiers compilés
Copy-Item -Path "dist\binance-bot-app\browser\*" -Destination "$deployDir\www" -Recurse

# Créer le dossier assets s'il n'existe pas
if (-not (Test-Path "$deployDir\www\assets")) {
    New-Item -ItemType Directory -Path "$deployDir\www\assets" | Out-Null
}

# Copier le config.js
Copy-Item -Path "src\assets\config.js" -Destination "$deployDir\www\assets\config.js"

# 3. Mettre à jour le backend
Write-Host "`n[3/3] Mise à jour du backend..." -ForegroundColor Yellow
# Supprimer et recréer le backend (sauf data)
$backendFiles = @("database.js", "package.json", "server.js", "test-data.json")
foreach ($file in $backendFiles) {
    if (Test-Path "backend\$file") {
        Copy-Item -Path "backend\$file" -Destination "$deployDir\backend\$file" -Force
    }
}

# Résumé
Write-Host "`n=== Build terminé ! ===" -ForegroundColor Green
Write-Host "Le package est prêt dans le dossier: $deployDir" -ForegroundColor Green
Write-Host "`nContenu du package:" -ForegroundColor Cyan
Write-Host "  - www/           : Application Angular"
Write-Host "  - backend/       : Backend Node.js (appelle Binance API)"
Write-Host "  - nginx.conf     : Configuration nginx"
Write-Host "  - supervisord.ini: Configuration supervisor"
Write-Host "  - Dockerfile     : Image Docker"
Write-Host "  - run.sh         : Script de démarrage"
Write-Host "  - config.json    : Configuration Home Assistant"
Write-Host "`nPour déployer sur Home Assistant:" -ForegroundColor Cyan
Write-Host "1. Copiez le contenu de '$deployDir' vers '/addons/binance-bot-dashboard/' sur votre HA"
Write-Host "2. Dans HA: Paramètres > Modules complémentaires > Boutique > ... > Vérifier les mises à jour"
Write-Host "3. Installez 'Binance Grid Bot Dashboard' depuis les add-ons locaux"
Write-Host "4. Configurez le mot de passe et le mode dans l'onglet Configuration"
Write-Host "`nOu utilisez SCP:" -ForegroundColor Cyan
Write-Host "scp -r $deployDir/* root@homeassistant.local:/addons/binance-bot-dashboard/"
