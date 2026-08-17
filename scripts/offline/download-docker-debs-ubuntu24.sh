#!/usr/bin/env bash
set -Eeuo pipefail

OUT="${1:-/out}"
mkdir -p "$OUT"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update

packages="$(
  apt-cache depends --recurse \
    --no-recommends --no-suggests --no-conflicts --no-breaks --no-replaces --no-enhances \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin \
    | awk '/PreDepends:|Depends:/{print $2} /^[[:alnum:]][[:alnum:].+:-]+$/{print $1}' \
    | grep -Ev '^<|>$' \
    | sort -u
)"

cd "$OUT"
apt-get download $packages
sha256sum ./*.deb > docker-debs.sha256
