export type SectionId = "main" | "consumer" | "ui";

export type ComponentId =
  | "complete-stack"
  | "streaming-server"
  | "nats"
  | "rtsp-engine"
  | "consumer-yolo"
  | "ui-dashboard";

export type DeploymentStatus = "idle" | "scanning" | "ready" | "running" | "success" | "failed";

export type FieldKind = "text" | "password" | "number" | "textarea" | "select";

export interface ConfigField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  help?: string;
  options?: { label: string; value: string }[];
}

export interface DeployComponent {
  id: ComponentId;
  section: SectionId;
  name: string;
  description: string;
  icon: "stream" | "play" | "network" | "database" | "stack" | "screen";
  packageHint: string;
  defaultScanDirs: string[];
  packagePatterns: string[];
  workDir: string;
  services: string[];
  fields: ConfigField[];
  procedure: string[];
}

export interface VmConnectionConfig {
  host: string;
  user: string;
  port: string;
  sshKeyPath: string;
  releaseDir: string;
  scanDirs: string;
  sudo: boolean;
}

export interface PackageFile {
  id: string;
  name: string;
  path: string;
  size: string;
  modified: string;
  componentId: ComponentId;
}

export interface DeploymentRequest {
  componentId: ComponentId;
  packagePath: string;
  vm: VmConnectionConfig;
  config: Record<string, string>;
}

export interface JobSnapshot {
  id: string;
  componentId: ComponentId;
  status: Exclude<DeploymentStatus, "idle" | "scanning" | "ready">;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  logs: string[];
}
