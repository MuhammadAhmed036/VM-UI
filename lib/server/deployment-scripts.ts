import { getComponent } from "@/lib/deployment-catalog";
import type { ComponentId, DeploymentRequest } from "@/lib/types";
import { jsonEnv, sh } from "./shell";

function commonHeader(request: DeploymentRequest) {
  const component = getComponent(request.componentId);
  const config = {
    ...request.config,
    vmIp: request.config.vmIp || request.vm.host,
    releaseDir: request.vm.releaseDir,
    packagePath: request.packagePath,
    componentName: component?.name ?? request.componentId,
  };

  return `#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CONFIG_JSON_B64=${sh(jsonEnv(config))}
export DEPLOY_CONFIG_JSON="$(printf '%s' "$CONFIG_JSON_B64" | base64 -d)"

cfg() {
  python3 - "$1" <<'PY'
import json, os, sys
data=json.loads(os.environ["DEPLOY_CONFIG_JSON"])
print(data.get(sys.argv[1], ""))
PY
}

log() { printf '[deploy-manager] %s\\n' "$*"; }
die() { printf '[deploy-manager][FAIL] %s\\n' "$*" >&2; exit 1; }
require_file() { [ -f "$1" ] || die "Missing file: $1"; }
require_dir() { [ -d "$1" ] || die "Missing directory: $1"; }

env_set() {
  local file="$1" key="$2" value="$3"
  ENV_FILE="$file" ENV_KEY="$key" ENV_VALUE="$value" python3 <<'PY'
import os
from pathlib import Path
p=Path(os.environ["ENV_FILE"])
key=os.environ["ENV_KEY"]
value=os.environ["ENV_VALUE"]
lines=p.read_text(encoding="utf-8").splitlines() if p.exists() else []
out=[]
found=False
for line in lines:
    if line.startswith(key + "="):
        out.append(f"{key}={value}")
        found=True
    else:
        out.append(line)
if not found:
    out.append(f"{key}={value}")
p.write_text("\\n".join(out) + "\\n", encoding="utf-8")
PY
}

env_set_quoted() {
  local file="$1" key="$2" value="$3"
  ENV_FILE="$file" ENV_KEY="$key" ENV_VALUE="$value" python3 <<'PY'
import os
from pathlib import Path
p=Path(os.environ["ENV_FILE"])
key=os.environ["ENV_KEY"]
value=os.environ["ENV_VALUE"].replace("\\\\", "\\\\\\\\").replace("'", "\\\\'")
rendered=f"{key}='{value}'"
lines=p.read_text(encoding="utf-8").splitlines() if p.exists() else []
out=[]
found=False
for line in lines:
    if line.startswith(key + "="):
        out.append(rendered)
        found=True
    else:
        out.append(line)
if not found:
    out.append(rendered)
p.write_text("\\n".join(out) + "\\n", encoding="utf-8")
PY
}

write_camera_route() {
  local subnet gateway iface
  subnet="$(cfg cameraSubnet)"
  gateway="$(cfg cameraGateway)"
  iface="$(cfg lanIface)"
  [ -n "$subnet" ] && [ -n "$gateway" ] && [ -n "$iface" ] || return 0
  log "Applying persistent camera route $subnet via $gateway dev $iface"
  ip route replace "$subnet" via "$gateway" dev "$iface"
  cat > /etc/systemd/system/safecity-camera-route.service <<EOF
[Unit]
Description=SafeCity Camera Network Route
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/ip route replace $subnet via $gateway dev $iface
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now safecity-camera-route.service
}

write_camera_inventory() {
  local target="$1"
  mkdir -p "$(dirname "$target")"
  python3 - "$target" <<'PY'
import json, os, sys
data=json.loads(os.environ["DEPLOY_CONFIG_JSON"])
raw=data.get("camerasJson", "").strip()
if not raw:
    raise SystemExit(0)
cameras=json.loads(raw)
if not isinstance(cameras, list) or not cameras:
    raise SystemExit("camera inventory must be a non-empty JSON array")
for cam in cameras:
    if not cam.get("name") or not cam.get("url"):
        raise SystemExit("each camera needs name and url")
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(cameras, f, indent=2)
    f.write("\\n")
print(f"camera inventory written: {len(cameras)} cameras")
PY
  chmod 600 "$target"
}

PACKAGE_PATH="$(cfg packagePath)"
VM_IP="$(cfg vmIp)"
RELEASE_DIR="$(cfg releaseDir)"
log "Component: $(cfg componentName)"
log "Package: $PACKAGE_PATH"
require_file "$PACKAGE_PATH"
`;
}

function streamingScript(request: DeploymentRequest) {
  return `${commonHeader(request)}
write_camera_route
WORK="/opt/offline-installer"
log "Preparing Streaming Server workspace"
mkdir -p "$WORK"
rm -rf "$WORK/streaming-server-offline-v1.0.0"
tar -xzf "$PACKAGE_PATH" -C "$WORK"
STREAM_DIR="$(find "$WORK" -maxdepth 1 -type d -name 'streaming-server-offline*' | head -1)"
require_dir "$STREAM_DIR"
cd "$STREAM_DIR"
[ -x ./install.sh ] || chmod 750 ./install.sh
[ ! -x ./verify_bundle.sh ] || ./verify_bundle.sh
write_camera_inventory "$STREAM_DIR/app/cameras.json"
log "Running Streaming install.sh"
printf '%s\n' \
  "$VM_IP" \
  "8554" \
  "8000" \
  "8889" \
  "8189" \
  "$(cfg streamWebUser)" \
  "$(cfg streamWebPass)" \
  "$(cfg streamReadUser)" \
  "$(cfg streamReadPass)" \
  "$(cfg streamPublishUser)" \
  "$(cfg streamPublishPass)" \
  | ./install.sh
log "Verifying Streaming deployment"
docker exec safecity-mediamtx bash /opt/mtxctl-tools/verify_deployment.sh || true
docker ps --filter name=safecity-mediamtx --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'
log "Streaming deployment finished"
`;
}

function natsScript(request: DeploymentRequest) {
  return `${commonHeader(request)}
log "Installing NAT-JetStream"
cd "$(dirname "$PACKAGE_PATH")"
[ ! -f "$PACKAGE_PATH.sha256" ] || sha256sum -c "$PACKAGE_PATH.sha256"
rm -rf /opt/natjet-offline-1.0.1
tar -xzf "$PACKAGE_PATH" -C /opt
cd /opt/natjet-offline-1.0.1
sha256sum -c MANIFEST.sha256
./scripts/install.sh --ip "$VM_IP"
TOKEN="$(awk -F= '$1=="NATS_AUTH_TOKEN"{print substr($0,index($0,"=")+1)}' .env)"
IMG="$(awk -F= '$1=="NATJET_IMAGE"{print substr($0,index($0,"=")+1)}' .env)"
[ -n "$TOKEN" ] && [ -n "$IMG" ] || die "NATS token/image missing after install"
docker run --pull=never --rm --network host -v "$PWD/scripts/testing:/t:ro" -v "$PWD/baseline:/bl:ro" --entrypoint python3 "$IMG" /t/provision-test-streams.py --nats "nats://\${TOKEN}@127.0.0.1:4222" --baseline /bl/stream-configs.json
unset TOKEN IMG
./scripts/verify.sh --base
systemctl enable natjet.service
docker update --restart unless-stopped natjet-nats natjet-sandbox >/dev/null
docker ps --filter name=natjet --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'
log "NATS deployment finished"
`;
}

function rtspScript(request: DeploymentRequest) {
  return `${commonHeader(request)}
INSTALLER="$(cfg rtspInstallerPath)"
INSTALLER="\${INSTALLER/#\\$HOME/$HOME}"
require_file "$INSTALLER"
NATJET="/opt/natjet-offline-1.0.1"
require_file "$NATJET/.env"
NATS_TOKEN="$(awk -F= '$1=="NATS_AUTH_TOKEN"{print substr($0,index($0,"=")+1)}' "$NATJET/.env")"
[ -n "$NATS_TOKEN" ] || die "NATS token missing"
WORK="$HOME/rtsp-offline"
rm -rf "$WORK"
mkdir -p "$WORK"
cp "$PACKAGE_PATH" "$WORK/"
cp "$INSTALLER" "$WORK/"
cd "$WORK"
tar -xzf "$(basename "$PACKAGE_PATH")"
chmod 750 "$(basename "$INSTALLER")"
log "Running golden RTSP installer"
printf '%s\\n' "$(cfg rtspEngineId)" "$(cfg natsHost)" "$NATS_TOKEN" "$(cfg timezone)" | ./"$(basename "$INSTALLER")"
unset NATS_TOKEN
docker inspect rtsp-engine --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} network={{.HostConfig.NetworkMode}} restart={{.HostConfig.RestartPolicy.Name}}'
docker image inspect safecity-rtsp-engine:golden-20260808 --format '{{.Id}}'
docker exec rtsp-engine sha256sum /app/rtsp-engine
python3 - <<'PY'
from urllib.request import urlopen
print(urlopen("http://127.0.0.1:8080/api/health", timeout=10).read().decode())
PY
cd /opt/natjet-offline-1.0.1 && ./scripts/verify.sh --pipeline
log "RTSP deployment finished"
`;
}

function yoloScript(request: DeploymentRequest) {
  return `${commonHeader(request)}
log "Installing YOLO Stage2 Consumer"
cd "$(dirname "$PACKAGE_PATH")"
[ ! -f "$PACKAGE_PATH.sha256" ] || sha256sum -c "$PACKAGE_PATH.sha256"
rm -rf /opt/yolo-stage2
tar -xzf "$PACKAGE_PATH" -C /opt
YOLO_DIR="/opt/yolo-stage2/bundle/deploy/stage2_docker"
require_file /opt/yolo-stage2/bundle/images.tar
require_file "$YOLO_DIR/install.sh"
require_file "$YOLO_DIR/docker-compose.yml"
require_file "$YOLO_DIR/postgres/migrations/011_drop_legacy_raw_status_index.sql"
cd "$YOLO_DIR"
rm -f ./yolo-stage2-offline-images.tar
ln -s ../../images.tar ./yolo-stage2-offline-images.tar
./install.sh --role full --ip "$VM_IP" --worker-id "$(cfg workerId)" --nats-url "$(cfg natsUrl)" --dashboard-port "$(cfg dashboardPort)" --postgres-port "$(cfg postgresPort)"
env_set "$YOLO_DIR/.env" NATS_SUBJECT "$(cfg natsSubject)"
docker compose up -d --pull never postgres
docker compose up -d --pull never dashboard helper-per-camera-retention
docker compose up -d --pull never --no-deps --force-recreate worker
docker update --restart unless-stopped yolo_postgres_stage2 yolo_event_viewer_stage2 yolo_helper_per_camera_retention_stage2 yolo_ov_nats_worker_stage2 >/dev/null || true
docker ps -a --filter name=yolo_ --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}'
python3 - <<'PY'
from urllib.request import urlopen
print(urlopen("http://127.0.0.1:18088/api/health", timeout=10).read().decode())
PY
log "YOLO Consumer deployment finished"
`;
}

function uiScript(request: DeploymentRequest) {
  return `${commonHeader(request)}
DASH_DIR="$(cfg uiWorkDir)"
[ -n "$DASH_DIR" ] || DASH_DIR="$HOME/safecity-dashboard"
DASH_DIR="\${DASH_DIR/#\\$HOME/$HOME}"
log "Preparing SafeCity UI dashboard in $DASH_DIR"
mkdir -p "$DASH_DIR"
tar -xf "$PACKAGE_PATH" -C "$DASH_DIR"
cd "$DASH_DIR"
chmod +x ./*.sh 2>/dev/null || true
if [ -x ./deploy.sh ] && [ ! -f ./.env ]; then
  log "Running deploy.sh once to initialize .env"
  ./deploy.sh || true
fi
touch .env
env_set_quoted .env APP_PORT "$(cfg appPort)"
env_set_quoted .env DETECTION_API_BASE_URL "$(cfg detectionApiBaseUrl)"
env_set_quoted .env STREAMS_API_URL "$(cfg streamsApiUrl)"
env_set_quoted .env STREAMS_API_USERNAME "$(cfg streamsApiUsername)"
env_set_quoted .env STREAMS_API_PASSWORD "$(cfg streamsApiPassword)"
env_set_quoted .env CAMERA_FEED_BASE_URL "$(cfg cameraFeedBaseUrl)"
env_set_quoted .env CAMERA_FEED_USERNAME "$(cfg cameraFeedUsername)"
env_set_quoted .env CAMERA_FEED_PASSWORD "$(cfg cameraFeedPassword)"
chmod 600 .env
if [ -x ./deploy.sh ]; then
  log "Running dashboard deploy.sh"
  ./deploy.sh
elif [ -f docker-compose.yml ] || [ -f compose.yml ] || [ -f compose.yaml ]; then
  log "No deploy.sh found; using Docker Compose"
  docker compose up -d --pull never --no-build
else
  die "No deploy.sh or compose file found in dashboard package"
fi
docker compose ps || docker ps --filter name=safecity-dashboard
log "SafeCity UI deployment finished"
`;
}

export function buildDeploymentScript(request: DeploymentRequest) {
  switch (request.componentId) {
    case "streaming-server":
      return streamingScript(request);
    case "nats":
      return natsScript(request);
    case "rtsp-engine":
      return rtspScript(request);
    case "consumer-yolo":
      return yoloScript(request);
    case "ui-dashboard":
      return uiScript(request);
    case "complete-stack":
      return completeStackNoticeScript(request);
    default:
      throw new Error(`Unsupported component: ${request.componentId}`);
  }
}

function completeStackNoticeScript(request: DeploymentRequest) {
  return `${commonHeader(request)}
log "Complete stack deployment uses the provided complete installer source of truth."
log "Looking for a complete installer script in the release directory or selected package."
INSTALLER=""
if [ -f "$PACKAGE_PATH" ] && [[ "$PACKAGE_PATH" == *.sh ]]; then
  INSTALLER="$PACKAGE_PATH"
elif [ -f "$RELEASE_DIR/complete_install.sh" ]; then
  INSTALLER="$RELEASE_DIR/complete_install.sh"
elif ls "$RELEASE_DIR"/complete_install*.sh >/dev/null 2>&1; then
  INSTALLER="$(ls "$RELEASE_DIR"/complete_install*.sh | head -1)"
elif ls "$RELEASE_DIR"/safecity-complete-install*.sh >/dev/null 2>&1; then
  INSTALLER="$(ls "$RELEASE_DIR"/safecity-complete-install*.sh | head -1)"
fi
[ -n "$INSTALLER" ] || die "Complete installer script not found. Deploy individual modules or place complete_install.sh in the release directory."
chmod 750 "$INSTALLER"
log "Found installer: $INSTALLER"
RESPONSES="/tmp/safecity-complete-install-responses.$$"
python3 - "$RESPONSES" <<'PY'
import json, os, sys
data=json.loads(os.environ["DEPLOY_CONFIG_JSON"])
cameras=json.loads(data.get("camerasJson", "[]"))
if not cameras:
    raise SystemExit("camera inventory is required for complete stack install")

def v(key, default=""):
    value=str(data.get(key, default))
    if value == "" and default == "":
        raise SystemExit(f"missing required complete-stack value: {key}")
    return value

lines = [
    v("releaseDir"),
    v("vmIp"),
    v("lanIface", "ens18"),
    v("cameraSubnet", "192.168.10.0/24"),
    v("cameraGateway", "192.168.18.1"),
    v("timezone", "Asia/Karachi"),
    v("streamWebUser", "admin"),
    v("streamWebPass"),
    v("streamWebPass"),
    v("streamReadUser", "stream_reader"),
    v("streamReadPass"),
    v("streamReadPass"),
    v("streamPublishUser", "stream_publisher"),
    v("streamPublishPass"),
    v("streamPublishPass"),
    v("rtspEngineId", "rtsp-engine-01"),
    v("rtspInterval", "1"),
    v("workerId"),
    str(len(cameras)),
]

for cam in cameras:
    lines.extend([
        str(cam.get("name", "")),
        str(cam.get("url", "")),
        str(cam.get("description", "")),
        str(cam.get("mode", "d")),
        str(cam.get("fps", 15)),
        "y" if cam.get("enabled", True) else "n",
    ])

lines.extend([
    "n",
    v("dashboardStreamsUser"),
    v("dashboardStreamsPass"),
    v("dashboardStreamsPass"),
    "n",
    v("dashboardFeedUser"),
    v("dashboardFeedPass"),
    v("dashboardFeedPass"),
    v("autoReboot", "n"),
])

with open(sys.argv[1], "w", encoding="utf-8") as f:
    f.write("\\n".join(lines) + "\\n")
os.chmod(sys.argv[1], 0o600)
print(f"response file prepared for {len(cameras)} camera(s)")
PY
log "Starting complete installer with UI-provided configuration"
"$INSTALLER" < "$RESPONSES"
rm -f "$RESPONSES"
`;
}

export function buildControlScript(componentId: ComponentId, action: string, config: Record<string, string>) {
  const component = getComponent(componentId);
  if (!component) throw new Error("Unknown component");
  const payload = jsonEnv({ ...config, componentId });
  const filters = component.services.map((name) => `--filter name=${name}`).join(" ");
  const serviceNames = component.services.join(" ");

  return `#!/usr/bin/env bash
set -Eeuo pipefail
CONFIG_JSON_B64=${sh(payload)}
export DEPLOY_CONFIG_JSON="$(printf '%s' "$CONFIG_JSON_B64" | base64 -d)"
cfg() { python3 - "$1" <<'PY'
import json, os, sys
print(json.loads(os.environ["DEPLOY_CONFIG_JSON"]).get(sys.argv[1], ""))
PY
}
log(){ printf '[deploy-manager] %s\\n' "$*"; }
ACTION=${sh(action)}
COMPONENT=${sh(componentId)}
case "$COMPONENT" in
  streaming-server) DIR="/opt/safecity-streaming" ;;
  nats) DIR="/opt/natjet-offline-1.0.1" ;;
  rtsp-engine) DIR="/opt/safecity-rtsp-engine" ;;
  consumer-yolo) DIR="/opt/yolo-stage2/bundle/deploy/stage2_docker" ;;
  ui-dashboard) DIR="$(cfg uiWorkDir)"; [ -n "$DIR" ] || DIR="$HOME/safecity-dashboard"; DIR="\${DIR/#\\$HOME/$HOME}" ;;
  *) DIR="" ;;
esac

have_docker() {
  command -v docker >/dev/null 2>&1
}

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

print_no_container() {
  echo "No deployed container found for this module."
  echo "Run Save & deploy first, then use Status or View logs."
}

show_containers() {
  local out
  out="$(docker ps -a ${filters} --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}')"
  if [ "$(printf '%s\\n' "$out" | wc -l)" -le 1 ]; then
    print_no_container
  else
    printf '%s\\n' "$out"
  fi
}

show_status() {
  if ! have_docker; then
    echo "Docker is not installed on this VM yet."
    echo "Streaming Server deployment installs the bundled offline Docker packages."
    return 0
  fi

  case "$COMPONENT" in
    streaming-server)
      if ! container_exists safecity-mediamtx; then print_no_container; return 0; fi
      echo "===== STREAMING CONTAINER ====="
      docker ps -a --filter name=safecity-mediamtx --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'
      echo
      echo "===== STREAM LIST ====="
      docker exec safecity-mediamtx python3 /usr/local/bin/mtxctl.py list || true
      echo
      echo "===== STREAMING VERIFY ====="
      docker exec safecity-mediamtx bash /opt/mtxctl-tools/verify_deployment.sh || true
      ;;
    nats)
      if ! container_exists natjet-nats && ! container_exists natjet-sandbox; then print_no_container; return 0; fi
      echo "===== NATS CONTAINERS ====="
      docker ps -a --filter name=natjet --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'
      echo
      echo "===== NATS SERVICE ====="
      systemctl status natjet.service --no-pager -l || true
      if [ -d /opt/natjet-offline-1.0.1 ]; then
        echo
        echo "===== NATS VERIFY ====="
        cd /opt/natjet-offline-1.0.1
        ./scripts/verify.sh --base || true
      fi
      ;;
    rtsp-engine)
      if ! container_exists rtsp-engine; then print_no_container; return 0; fi
      echo "===== RTSP CONTAINER ====="
      docker ps -a --filter name=rtsp-engine --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'
      docker inspect rtsp-engine --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} network={{.HostConfig.NetworkMode}} restart={{.HostConfig.RestartPolicy.Name}}' || true
      echo
      echo "===== RTSP IMAGE ====="
      docker image inspect safecity-rtsp-engine:golden-20260808 --format '{{.Id}}' || true
      echo
      echo "===== RTSP HEALTH API ====="
      python3 - <<'PY' || true
from urllib.request import urlopen
print(urlopen("http://127.0.0.1:8080/api/health", timeout=10).read().decode())
PY
      ;;
    consumer-yolo)
      if ! docker ps -a --filter name=yolo_ --format '{{.Names}}' | grep -q .; then print_no_container; return 0; fi
      echo "===== YOLO CONTAINERS ====="
      docker ps -a --filter name=yolo_ --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}'
      echo
      echo "===== YOLO HEALTH ====="
      for c in yolo_postgres_stage2 yolo_event_viewer_stage2 yolo_helper_per_camera_retention_stage2 yolo_ov_nats_worker_stage2; do
        docker inspect "$c" --format '{{.Name}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restart={{.HostConfig.RestartPolicy.Name}}' 2>/dev/null || true
      done
      echo
      echo "===== YOLO API ====="
      python3 - <<'PY' || true
from urllib.request import urlopen
print(urlopen("http://127.0.0.1:18088/api/health", timeout=10).read().decode())
PY
      ;;
    ui-dashboard)
      show_containers
      [ -n "$DIR" ] && [ -d "$DIR" ] && (cd "$DIR" && docker compose ps || true)
      ;;
    *)
      show_containers
      ;;
  esac
}

show_logs() {
  if ! have_docker; then
    echo "Docker is not installed on this VM yet."
    return 0
  fi

  case "$COMPONENT" in
    streaming-server)
      if ! container_exists safecity-mediamtx; then print_no_container; return 0; fi
      docker logs --tail 240 safecity-mediamtx 2>&1
      ;;
    nats)
      if ! container_exists natjet-nats && ! container_exists natjet-sandbox; then print_no_container; return 0; fi
      echo "===== NATJET SERVICE LOGS ====="
      journalctl -u natjet.service --no-pager -n 120 -l || true
      echo
      for c in natjet-nats natjet-sandbox; do
        if container_exists "$c"; then
          echo "===== $c LOGS ====="
          docker logs --tail 160 "$c" 2>&1 || true
        fi
      done
      ;;
    rtsp-engine)
      if ! container_exists rtsp-engine; then print_no_container; return 0; fi
      docker logs --tail 240 rtsp-engine 2>&1 \
        | sed -E 's#(nats://)[^@ ]+@#\\1***@#g; s#(rtsp://)[^@ ]+@#\\1***:***@#g' \
        | grep -Ei 'RTSP Snapshot Engine|worker|ffmpeg|snapshot|nats|publish|frames|error|fail|timeout|health' \
        || true
      ;;
    consumer-yolo)
      if ! docker ps -a --filter name=yolo_ --format '{{.Names}}' | grep -q .; then print_no_container; return 0; fi
      for c in yolo_ov_nats_worker_stage2 yolo_event_viewer_stage2 yolo_helper_per_camera_retention_stage2 yolo_postgres_stage2; do
        if container_exists "$c"; then
          echo "===== $c LOGS ====="
          docker logs --tail 180 "$c" 2>&1 \
            | sed -E 's#(nats://)[^@ ]+@#\\1***@#g' \
            | tail -180 || true
          echo
        fi
      done
      ;;
    ui-dashboard)
      if ! container_exists safecity-dashboard; then print_no_container; return 0; fi
      docker logs --tail 240 safecity-dashboard 2>&1
      ;;
    *)
      local found=0
      for c in ${serviceNames}; do
        if container_exists "$c"; then
          found=1
          echo "===== $c LOGS ====="
          docker logs --tail 160 "$c" 2>&1 || true
        fi
      done
      [ "$found" = "1" ] || print_no_container
      ;;
  esac
}

if [ "$ACTION" = "status" ]; then
  show_status
  exit 0
fi

if [ "$ACTION" = "logs" ]; then
  show_logs
  exit 0
fi

[ -n "$DIR" ] && [ -d "$DIR" ] && cd "$DIR"

case "$ACTION" in
  start)
    if [ "$COMPONENT" = "nats" ]; then systemctl start natjet.service; else docker compose up -d --pull never; fi
    ;;
  stop)
    if [ "$COMPONENT" = "nats" ]; then systemctl stop natjet.service; else docker compose down; fi
    ;;
  restart)
    if [ "$COMPONENT" = "nats" ]; then systemctl restart natjet.service; else docker compose restart; fi
    ;;
  apply-config)
    if [ "$COMPONENT" = "ui-dashboard" ] && [ -x ./update-env.sh ]; then
      ./update-env.sh
    elif [ "$COMPONENT" = "consumer-yolo" ]; then
      docker compose up -d --no-deps --force-recreate --pull never dashboard helper-per-camera-retention worker
    else
      docker compose up -d --force-recreate --pull never
    fi
    ;;
  *)
    echo "Unsupported action: $ACTION" >&2
    exit 2
    ;;
esac
docker ps -a ${filters} --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' || true
`;
}
