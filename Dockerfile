# Stage 1: Build Angular app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the Angular app for production
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Copy backend source
COPY backend/server.js ./

# Stage 3: Final image with nginx + Node.js backend
FROM node:20-alpine

# Install nginx and supervisor
RUN apk add --no-cache nginx curl supervisor

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built Angular app
COPY --from=builder /app/dist/binance-bot-app/browser /usr/share/nginx/html

# Copy backend
COPY --from=backend-builder /backend /backend

# Create data directory for persistence
RUN mkdir -p /data && chown -R node:node /data

# Create supervisor config to run both nginx and Node.js
RUN mkdir -p /etc/supervisor.d
COPY <<EOF /etc/supervisor.d/supervisord.ini
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
environment=PORT=3000
EOF

# Expose port 4201
EXPOSE 4201

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4201/ && curl -f http://localhost:3000/api/health || exit 1

# Start supervisor (which runs nginx + backend)
CMD ["supervisord", "-c", "/etc/supervisor.d/supervisord.ini"]
