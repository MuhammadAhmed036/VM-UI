#!/usr/bin/env bash
set -Eeuo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TAR="$BASE/images/deploy-manager-ui.tar"
IMAGE="${IMAGE:-safecity/deploy-manager-ui:latest}"
APP_PORT="${APP_PORT:-3000}"
VM_USER="${SAFECITY_VM_USER:-${SUDO_USER:-${USER:-safecity}}}"
RELEASE_DIR="${SAFECITY_RELEASE_DIR:-/home/$VM_USER/SAFECITY_RELEASE}"

log() { printf '[offline-install] %s\n' "$*"; }
die() { printf '[offline-install][FAIL] %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "Run with sudo: sudo ./install-offline.sh"
[ -f "$IMAGE_TAR" ] || die "Missing image tar: $IMAGE_TAR"

install_docker_offline() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and Docker Compose are already installed"
    return 0
  fi

  [ -d "$BASE/docker-debs" ] || die "Docker is missing and docker-debs directory is not present"
  if [ -f "$BASE/docker-debs.sha256" ]; then
    (cd "$BASE" && sha256sum -c docker-debs.sha256)
  fi

  log "Installing Docker Engine from offline .deb packages"
  dpkg -i "$BASE"/docker-debs/*.deb || {
    log "Retrying package configuration after initial dependency ordering pass"
    dpkg -i "$BASE"/docker-debs/*.deb
  }

  command -v docker >/dev/null 2>&1 || die "Docker binary is still unavailable after offline install"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 plugin is unavailable after offline install"
}

install_docker_offline

log "Starting Docker"
systemctl enable --now docker

log "Preparing release directory: $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
chmod 755 "$(dirname "$RELEASE_DIR")" "$RELEASE_DIR" 2>/dev/null || true

log "Loading Deploy Manager UI image"
docker load -i "$IMAGE_TAR"

cat > "$BASE/.env" <<EOF
APP_PORT=$APP_PORT
SAFECITY_VM_USER=$VM_USER
SAFECITY_RELEASE_DIR=$RELEASE_DIR
EOF
chmod 600 "$BASE/.env"

log "Starting Deploy Manager UI"
cd "$BASE"
docker compose up -d --pull never

log "Status"
docker ps --filter name=deploy-manager-ui --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

cat <<EOF

Deploy Manager UI is ready.

Open:
  http://$(hostname -I | awk '{print $1}'):$APP_PORT

Release packages directory:
  $RELEASE_DIR

EOF
