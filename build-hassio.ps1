# Script de préparation du package pour Home Assistant
# Usage: .\build-hassio.ps1

Write-Host "=== Build Binance Bot Dashboard pour Hassio ===" -ForegroundColor Cyan

# 1. Build Angular
Write-Host "`n[1/6] Build de l'application Angular..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du build Angular" -ForegroundColor Red
    exit 1
}

# 2. Créer le dossier de déploiement
Write-Host "`n[2/6] Préparation du dossier de déploiement..." -ForegroundColor Yellow
$deployDir = "deploy-hassio"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null
New-Item -ItemType Directory -Path "$deployDir\www" | Out-Null
New-Item -ItemType Directory -Path "$deployDir\backend" | Out-Null

# 3. Copier les fichiers Angular
Write-Host "`n[3/6] Copie des fichiers Angular..." -ForegroundColor Yellow
Copy-Item -Path "dist\binance-bot-app\browser\*" -Destination "$deployDir\www" -Recurse

# 4. Copier le backend
Write-Host "`n[4/6] Copie du backend Node.js..." -ForegroundColor Yellow
Copy-Item -Path "backend\*" -Destination "$deployDir\backend" -Recurse

# 5. Copier les fichiers de configuration
Write-Host "`n[5/6] Copie des fichiers de configuration..." -ForegroundColor Yellow
Copy-Item -Path "hassio-addon\config.json" -Destination "$deployDir\"
Copy-Item -Path "hassio-addon\README.md" -Destination "$deployDir\"

# 6. Créer les fichiers de déploiement
Write-Host "`n[6/6] Création des fichiers de déploiement..." -ForegroundColor Yellow

# Créer nginx.conf
$nginxConf = @"
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    server {
        listen 4201;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files `$uri `$uri/ /index.html;
        }

        # Proxy API calls to Node.js backend
        location /api/ {
            proxy_pass http://localhost:3000/api/;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_connect_timeout 30s;
            proxy_read_timeout 30s;
        }

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
}
"@
$nginxConf | Out-File -FilePath "$deployDir\nginx.conf" -Encoding UTF8

# Créer supervisord.ini
$supervisord = @"
[supervisord]
nodaemon=true
user=root

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=node /backend/server.js
directory=/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=PORT=3000,MODE=%(ENV_MODE)s,DATA_DIR=%(ENV_DATA_DIR)s
"@
$supervisord | Out-File -FilePath "$deployDir\supervisord.ini" -Encoding UTF8

# Créer run.sh
$runSh = @"
#!/usr/bin/env bash
set -e

CONFIG_PATH=/data/options.json

echo "Starting Binance Grid Bot Dashboard..."

# Default mode for production is 'live'
MODE="live"
PASSWORD=""
BINANCE_API_KEY=""
BINANCE_SECRET_KEY=""

if [ -f "`$CONFIG_PATH" ]; then
  BINANCE_API_KEY=`$(jq -r '.binance_api_key // ""' `$CONFIG_PATH)
  BINANCE_SECRET_KEY=`$(jq -r '.binance_secret_key // ""' `$CONFIG_PATH)
  MODE=`$(jq -r '.mode // "live"' `$CONFIG_PATH)
  PASSWORD=`$(jq -r '.password // ""' `$CONFIG_PATH)

  echo "Mode: `${MODE}"
  echo "Password protection: `$([ -n "`$PASSWORD" ] && echo 'enabled' || echo 'disabled')"

  cat > /usr/share/nginx/html/assets/config.js << EOF
window.BINANCE_CONFIG = {
  apiKey: "`${BINANCE_API_KEY}",
  secretKey: "`${BINANCE_SECRET_KEY}",
  mode: "`${MODE}",
  password: "`${PASSWORD}"
};
EOF

  echo "Configuration loaded from Home Assistant."
else
  echo "No Home Assistant config found, using default config (mode: `${MODE})."
fi

# Export MODE for the backend
export MODE="`${MODE}"
export BINANCE_API_KEY="`${BINANCE_API_KEY}"
export BINANCE_SECRET_KEY="`${BINANCE_SECRET_KEY}"
export DATA_DIR="/data"

echo "Starting supervisor (nginx + Node.js backend)..."
echo "Backend will run in '`${MODE}' mode"
echo "Database will be stored in '`${DATA_DIR}'"
exec supervisord -c /etc/supervisor.d/supervisord.ini
"@
$runSh | Out-File -FilePath "$deployDir\run.sh" -Encoding UTF8 -NoNewline

# Créer Dockerfile
$dockerfile = @"
# Binance Grid Bot Dashboard - Home Assistant Add-on
FROM node:20-alpine

# Install required packages
RUN apk add --no-cache curl jq bash nginx supervisor

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy Angular build
COPY www /usr/share/nginx/html

# Create assets directory for config
RUN mkdir -p /usr/share/nginx/html/assets

# Copy backend
COPY backend /backend
WORKDIR /backend
RUN npm ci --only=production

# Create data directory
RUN mkdir -p /data && chown -R node:node /data

# Create supervisor config
RUN mkdir -p /etc/supervisor.d
COPY supervisord.ini /etc/supervisor.d/supervisord.ini

# Copy run script
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 4201

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4201/ && curl -f http://localhost:3000/api/health || exit 1

CMD ["/run.sh"]
"@
$dockerfile | Out-File -FilePath "$deployDir\Dockerfile" -Encoding UTF8

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
