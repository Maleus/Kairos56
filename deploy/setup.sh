#!/usr/bin/env bash
# One-shot DocuSeal server setup for Ubuntu 24.04 (DigitalOcean droplet).
# Run as root:  bash setup.sh sign.kairos56.org
set -euo pipefail

SIGN_DOMAIN="${1:?Usage: bash setup.sh <sign-domain>  e.g. bash setup.sh sign.kairos56.org}"

echo "==> Updating system"
apt-get update -y && apt-get upgrade -y

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Basic firewall"
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Adding 2GB swap (helps on 1GB droplets)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Starting DocuSeal"
mkdir -p /opt/docuseal && cd /opt/docuseal
# Expect docker-compose.yml + Caddyfile alongside this script, or download them:
if [ ! -f docker-compose.yml ]; then
  echo "Copy deploy/docker-compose.yml and deploy/Caddyfile to /opt/docuseal first." >&2
  exit 1
fi
SIGN_DOMAIN="$SIGN_DOMAIN" docker compose up -d

echo "==> Installing nightly backup cron"
cat > /etc/cron.daily/docuseal-backup << 'EOF'
#!/bin/bash
# Nightly DocuSeal data backup with 14-day rotation
BACKUP_DIR=/opt/docuseal/backups
mkdir -p "$BACKUP_DIR"
tar czf "$BACKUP_DIR/docuseal-$(date +%F).tar.gz" -C /opt/docuseal docuseal-data
find "$BACKUP_DIR" -name 'docuseal-*.tar.gz' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/docuseal-backup

echo ""
echo "✅ Done. Once DNS for $SIGN_DOMAIN points here, open https://$SIGN_DOMAIN"
echo "   and create the admin account. Then: Settings → API to get the API token."
