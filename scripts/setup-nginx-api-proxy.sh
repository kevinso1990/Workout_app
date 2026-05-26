#!/usr/bin/env bash
# Hostinger VPS: reverse-proxy public HTTP(S) to Express on localhost:5000
# Usage (as root on server):
#   chmod +x scripts/setup-nginx-api-proxy.sh
#   API_DOMAIN=api.example.com ./scripts/setup-nginx-api-proxy.sh
#
# Requires: nginx, workout-api listening on 127.0.0.1:5000 (PM2)

set -euo pipefail

API_DOMAIN="${API_DOMAIN:-}"
UPSTREAM_PORT="${UPSTREAM_PORT:-5000}"
EMAIL="${EMAIL:-admin@${API_DOMAIN:-localhost}}"

if [[ -z "$API_DOMAIN" ]]; then
  echo "Set API_DOMAIN, e.g. API_DOMAIN=api.example.com $0"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

cat > "/etc/nginx/sites-available/${API_DOMAIN}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${API_DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/${API_DOMAIN}" "/etc/nginx/sites-enabled/${API_DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if command -v certbot >/dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx; then
  certbot --nginx -d "${API_DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" || true
fi

echo "Proxy ready: http://${API_DOMAIN} -> 127.0.0.1:${UPSTREAM_PORT}"
echo "Update EXPO_PUBLIC_API_URL to https://${API_DOMAIN} and rebuild the app."
