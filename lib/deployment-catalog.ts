import type { ConfigField, DeployComponent, SectionId } from "./types";

const defaultCameraJson = JSON.stringify(
  [
    {
      name: "Gelecek_Office",
      url: "rtsp://username:password@192.168.10.241:554/stream",
      description: "Office camera",
      mode: "d",
      fps: 15,
      enabled: true,
    },
    {
      name: "entrance",
      url: "rtsp://username:password@192.168.10.243:554/stream",
      description: "Entrance camera",
      mode: "d",
      fps: 15,
      enabled: true,
    },
    {
      name: "kitchen_Cooridor",
      url: "rtsp://username:password@192.168.10.244:554/stream",
      description: "Kitchen corridor camera",
      mode: "d",
      fps: 15,
      enabled: true,
    },
  ],
  null,
  2,
);

const vmFields: ConfigField[] = [
  { key: "vmIp", label: "VM IP", kind: "text", required: true, placeholder: "192.168.18.216" },
  { key: "lanIface", label: "LAN interface", kind: "text", required: true, defaultValue: "ens18" },
  { key: "timezone", label: "Timezone", kind: "text", required: true, defaultValue: "Asia/Karachi" },
];

const cameraFields: ConfigField[] = [
  { key: "cameraSubnet", label: "Camera subnet CIDR", kind: "text", required: true, defaultValue: "192.168.10.0/24" },
  { key: "cameraGateway", label: "Camera gateway", kind: "text", required: true, defaultValue: "192.168.18.1" },
  {
    key: "camerasJson",
    label: "Camera inventory JSON",
    kind: "textarea",
    required: true,
    defaultValue: defaultCameraJson,
    placeholder:
      '[{"name":"entrance","url":"rtsp://user:pass@192.168.10.241:554/stream","description":"Entrance","mode":"d","fps":15,"enabled":true}]',
    help: "Each camera needs name, url, mode b/c/d, fps, and enabled.",
  },
];

export const COMPONENTS: DeployComponent[] = [
  {
    id: "streaming-server",
    section: "main",
    name: "Streaming Server",
    description: "Install the offline Streaming Server bundle and configure camera publishing.",
    icon: "stream",
    packageHint: "streaming-server-offline-v1.0.0-amd64.tar.gz",
    defaultScanDirs: ["$HOME/SAFECITY_RELEASE"],
    packagePatterns: ["streaming-server-offline*.tar.gz", "streaming-server*.tar"],
    workDir: "/opt/offline-installer/streaming-server-offline-v1.0.0",
    services: ["safecity-mediamtx"],
    fields: [
      ...vmFields,
      ...cameraFields,
      { key: "streamWebUser", label: "Web/API username", kind: "text", required: true, defaultValue: "admin" },
      { key: "streamWebPass", label: "Web/API password", kind: "password", required: true },
      { key: "streamReadUser", label: "RTSP read username", kind: "text", required: true, defaultValue: "stream_reader" },
      { key: "streamReadPass", label: "RTSP read password", kind: "password", required: true },
      { key: "streamPublishUser", label: "RTSP publish username", kind: "text", required: true, defaultValue: "stream_publisher" },
      { key: "streamPublishPass", label: "RTSP publish password", kind: "password", required: true },
    ],
    procedure: [
      "Extract the offline bundle under /opt/offline-installer.",
      "Run verify_bundle.sh when present.",
      "Run install.sh and verify the mediamtx deployment.",
      "Validate enabled cameras and container health.",
    ],
  },
  {
    id: "rtsp-engine",
    section: "main",
    name: "Golden RTSP Engine",
    description: "Install the golden RTSP Snapshot Engine and bind Streaming outputs to NATS.",
    icon: "play",
    packageHint: "rtsp-engine-known-good-1.0.0-x86_64-20260808-135340.tar.gz",
    defaultScanDirs: ["$HOME/SAFECITY_RELEASE"],
    packagePatterns: ["rtsp-engine-known-good*.tar.gz"],
    workDir: "/opt/safecity-rtsp-engine",
    services: ["rtsp-engine"],
    fields: [
      ...vmFields,
      { key: "rtspEngineId", label: "RTSP engine ID", kind: "text", required: true, defaultValue: "rtsp-engine-01" },
      { key: "rtspInstallerPath", label: "Golden installer path", kind: "text", required: true, defaultValue: "$HOME/SAFECITY_RELEASE/INSTALL_CLEAN_RTSP_GOLDEN.sh" },
      { key: "natsHost", label: "NATS host for RTSP", kind: "text", required: true, defaultValue: "127.0.0.1" },
    ],
    procedure: [
      "Verify RTSP archive and INSTALL_CLEAN_RTSP_GOLDEN.sh when sha256 files exist.",
      "Copy files into a clean rtsp-offline directory.",
      "Read the NATS token without printing it.",
      "Run INSTALL_CLEAN_RTSP_GOLDEN.sh and verify image ID, binary SHA, health, and pipeline.",
    ],
  },
  {
    id: "nats",
    section: "main",
    name: "NATS / JetStream",
    description: "Install NAT-JetStream v1.0.1, provision FRAMES_PREVIEW and FRAMES_V2, and enable reboot policy.",
    icon: "network",
    packageHint: "natjet-offline-1.0.1-x86_64.tar.gz",
    defaultScanDirs: ["$HOME/SAFECITY_RELEASE"],
    packagePatterns: ["natjet-offline-*.tar.gz"],
    workDir: "/opt/natjet-offline-1.0.1",
    services: ["natjet-nats", "natjet-sandbox"],
    fields: [...vmFields],
    procedure: [
      "Verify the selected archive sha256 when its sidecar exists.",
      "Extract NAT-JetStream into /opt.",
      "Run scripts/install.sh --ip VM_IP.",
      "Provision FRAMES_PREVIEW and FRAMES_V2, then verify base health.",
    ],
  },
  {
    id: "consumer-yolo",
    section: "consumer",
    name: "YOLO Stage2 Consumer",
    description: "Deploy, configure, and manage the YOLO full-role consumer with PostgreSQL and event viewer.",
    icon: "database",
    packageHint: "yolo-stage2-220-clean-airgap.tar.gz",
    defaultScanDirs: ["$HOME/SAFECITY_RELEASE"],
    packagePatterns: ["yolo-stage2-*.tar.gz"],
    workDir: "/opt/yolo-stage2/bundle/deploy/stage2_docker",
    services: ["yolo_postgres_stage2", "yolo_event_viewer_stage2", "yolo_helper_per_camera_retention_stage2", "yolo_ov_nats_worker_stage2"],
    fields: [
      ...vmFields,
      { key: "workerId", label: "Worker ID", kind: "text", required: true, placeholder: "person-worker-216" },
      { key: "natsUrl", label: "NATS URL", kind: "text", required: true, placeholder: "nats://root@192.168.18.216:4222" },
      { key: "natsSubject", label: "NATS subject", kind: "text", required: true, defaultValue: "frames.v2.>" },
      { key: "dashboardPort", label: "YOLO API/dashboard port", kind: "number", required: true, defaultValue: "18088" },
      { key: "postgresPort", label: "PostgreSQL public port", kind: "number", required: true, defaultValue: "15432" },
    ],
    procedure: [
      "Verify the YOLO archive checksum.",
      "Extract to /opt/yolo-stage2 and link yolo-stage2-offline-images.tar.",
      "Run install.sh --role full with VM IP, worker ID, NATS URL, dashboard port, and PostgreSQL port.",
      "Apply later .env changes by recreating dashboard, helper, and worker only; PostgreSQL stays untouched.",
    ],
  },
  {
    id: "ui-dashboard",
    section: "ui",
    name: "SafeCity UI Dashboard",
    description: "Deploy the dashboard package last and apply .env changes through update-env.sh.",
    icon: "screen",
    packageHint: "safecity-dashboard-0.1.0.tar",
    defaultScanDirs: ["$HOME/SAFECITY_RELEASE"],
    packagePatterns: ["safecity-dashboard-*.tar", "aiphase2-dashboard-*.tar.gz"],
    workDir: "$HOME/safecity-dashboard",
    services: ["safecity-dashboard"],
    fields: [
      ...vmFields,
      { key: "appPort", label: "APP_PORT", kind: "number", required: true, defaultValue: "3000" },
      { key: "detectionApiBaseUrl", label: "DETECTION_API_BASE_URL", kind: "text", required: true, placeholder: "http://192.168.18.216:18088" },
      { key: "streamsApiUrl", label: "STREAMS_API_URL", kind: "text", required: true, placeholder: "http://192.168.18.216:8000/api/streams/list" },
      { key: "streamsApiUsername", label: "STREAMS_API_USERNAME", kind: "text", required: true },
      { key: "streamsApiPassword", label: "STREAMS_API_PASSWORD", kind: "password", required: true },
      { key: "cameraFeedBaseUrl", label: "CAMERA_FEED_BASE_URL", kind: "text", required: true, placeholder: "http://192.168.18.216:8889" },
      { key: "cameraFeedUsername", label: "CAMERA_FEED_USERNAME", kind: "text", required: true },
      { key: "cameraFeedPassword", label: "CAMERA_FEED_PASSWORD", kind: "password", required: true },
    ],
    procedure: [
      "Extract the selected dashboard tar into the dashboard work directory.",
      "Run deploy.sh once if needed to create .env.",
      "Write APP_PORT and all API/feed credentials from the UI.",
      "Run deploy.sh for first deployment and update-env.sh for later configuration changes.",
    ],
  },
];

export function getComponentsBySection(section: SectionId) {
  return COMPONENTS.filter((component) => component.section === section);
}

export function getComponent(componentId: string) {
  return COMPONENTS.find((component) => component.id === componentId);
}
