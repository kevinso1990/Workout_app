#!/usr/bin/env bash
# Hostinger VPS: serve Expo web PWA at / and proxy /api/* to Express on :5000
# Usage (as root): ./scripts/setup-nginx-web-pwa.sh

set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/var/www/fitplan-web}"
UPSTREAM_PORT="${UPSTREAM_PORT:-5000}"

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

mkdir -p "$WEB_ROOT"

cat > /etc/nginx/sites-available/fitplan-web <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 25m;

    root ${WEB_ROOT};
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/fitplan-web /etc/nginx/sites-enabled/fitplan-web
rm -f /etc/nginx/sites-enabled/workout-api /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t
systemctl reload nginx

echo "Web PWA: http://SERVER_IP/  (static from ${WEB_ROOT})"
echo "API:     http://SERVER_IP/api/* -> 127.0.0.1:${UPSTREAM_PORT}"
