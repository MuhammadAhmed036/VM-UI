#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${OUT:-$ROOT/dist/deploy-manager-ui-offline}"
ARCHIVE="${ARCHIVE:-$ROOT/dist/deploy-manager-ui-offline.tar.gz}"
IMAGE="${IMAGE:-safecity/deploy-manager-ui:latest}"
DOCKER_DEB_DIR="$OUT/docker-debs"

log() { printf '[offline-build] %s\n' "$*"; }
die() { printf '[offline-build][FAIL] %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Docker is required on the internet-connected build machine"

rm -rf "$OUT"
mkdir -p "$OUT/images" "$DOCKER_DEB_DIR"

log "Building $IMAGE"
docker build -t "$IMAGE" "$ROOT"

log "Saving Docker image"
docker save "$IMAGE" -o "$OUT/images/deploy-manager-ui.tar"

log "Copying offline runtime files"
cp "$ROOT/docker-compose.yml" "$OUT/docker-compose.yml"
cp "$ROOT/scripts/offline/install-offline.sh" "$OUT/install-offline.sh"
cp "$ROOT/scripts/offline/README-OFFLINE.md" "$OUT/README-OFFLINE.md"
chmod 750 "$OUT/install-offline.sh"

if command -v apt-get >/dev/null 2>&1; then
  command -v curl >/dev/null 2>&1 || die "curl is required to configure Docker apt repository on the build machine"
  log "Downloading Docker Engine .deb packages for offline VM install"
  sudo install -d -m 755 /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
    sudo chmod a+r /etc/apt/keyrings/docker.asc
  fi

  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt-get update
  mkdir -p "$DOCKER_DEB_DIR/partial"
  packages="$(
    apt-cache depends --recurse \
      --no-recommends --no-suggests --no-conflicts --no-breaks --no-replaces --no-enhances \
      docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin \
      | awk '/PreDepends:|Depends:/{print $2} /^[[:alnum:]][[:alnum:].+:-]+$/{print $1}' \
      | grep -Ev '^<|>$' \
      | sort -u
  )"

  (cd "$DOCKER_DEB_DIR" && apt-get download $packages)

  (cd "$OUT" && find docker-debs -name '*.deb' -print0 | sort -z | xargs -0 -r sha256sum > docker-debs.sha256)
else
  log "apt-get not found; skipping Docker .deb download"
fi

(cd "$OUT" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 -r sha256sum > MANIFEST.sha256)

log "Creating one-file offline archive"
rm -f "$ARCHIVE"
tar -C "$(dirname "$OUT")" -czf "$ARCHIVE" "$(basename "$OUT")"

log "Offline bundle ready: $OUT"
log "Offline tar ready: $ARCHIVE"
log "Copy the tar to the air-gapped Ubuntu VM, extract it, and run: sudo ./install-offline.sh"
