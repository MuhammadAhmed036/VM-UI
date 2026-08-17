"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DeployComponent, DeploymentStatus, JobSnapshot, PackageFile, VmConnectionConfig } from "@/lib/types";
import { BoltIcon, CheckIcon, FolderIcon, RefreshIcon, SettingsIcon, StopIcon, TerminalIcon } from "./Icons";

const defaultVm: VmConnectionConfig = {
  host: "local",
  user: "",
  port: "22",
  sshKeyPath: "",
  releaseDir: "$HOME/SAFECITY_RELEASE",
  scanDirs: "$HOME/SAFECITY_RELEASE",
  sudo: true,
};

function statusText(status: DeploymentStatus) {
  if (status === "idle") return "Not scanned";
  if (status === "scanning") return "Scanning";
  if (status === "ready") return "Ready";
  if (status === "running") return "Running";
  if (status === "success") return "Completed";
  return "Failed";
}

function defaultsFor(component: DeployComponent) {
  return Object.fromEntries(component.fields.map((field) => [field.key, field.defaultValue ?? ""]));
}

export function DeploymentWorkspace({ component }: { component: DeployComponent }) {
  const [vm, setVm] = useState<VmConnectionConfig>(() => ({
    ...defaultVm,
    scanDirs: component.defaultScanDirs.join("\n"),
  }));
  const [config, setConfig] = useState<Record<string, string>>(() => defaultsFor(component));
  const [status, setStatus] = useState<DeploymentStatus>("idle");
  const [packages, setPackages] = useState<PackageFile[]>([]);
  const [selectedPackagePath, setSelectedPackagePath] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [jobId, setJobId] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const selectedPackage = packages.find((item) => item.path === selectedPackagePath) ?? null;

  const fieldRows = useMemo(() => component.fields, [component]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (!jobId || status !== "running") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/deployments/${jobId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { job: JobSnapshot };
      setLogs(data.job.logs);
      setStatus(data.job.status);
    }, 1200);
    return () => clearInterval(timer);
  }, [jobId, status]);

  function patchVm(key: keyof VmConnectionConfig, value: string | boolean) {
    setVm((current) => ({ ...current, [key]: value }));
  }

  function patchConfig(key: string, value: string) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const local = ["", "local", "localhost", "127.0.0.1", "::1"].includes(vm.host.trim().toLowerCase());
    if (!local && (!vm.host.trim() || !vm.user.trim())) return "Remote VM IP/host and SSH user are required.";
    if (!selectedPackagePath) return "Select a package from the VM first.";
    const missing = component.fields.find((field) => field.required && !String(config[field.key] ?? "").trim());
    if (missing) return `${missing.label} is required.`;
    return "";
  }

  async function scanPackages() {
    setStatus("scanning");
    setLogs(["Scanning configured directories on this Ubuntu VM..."]);
    setSelectedPackagePath("");

    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ componentId: component.id, vm }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("failed");
      setLogs([data.error ?? "Package scan failed"]);
      return;
    }

    setPackages(data.packages);
    setSelectedPackagePath(data.packages[0]?.path ?? "");
    setStatus("ready");
    setLogs([`Found ${data.packages.length} package(s) for ${component.name}.`]);
  }

  async function startJob(endpoint: "/api/deployments" | "/api/control", payload: Record<string, unknown>) {
    setStatus("running");
    setLogs(["Starting remote job..."]);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus("failed");
      setLogs([data.error ?? "Unable to start job"]);
      return;
    }
    setJobId(data.jobId);
  }

  function deploy() {
    const error = validate();
    if (error) {
      setStatus("failed");
      setLogs([error]);
      return;
    }
    void startJob("/api/deployments", {
      componentId: component.id,
      packagePath: selectedPackagePath,
      vm,
      config,
    });
  }

  function runAction(action: string) {
    void startJob("/api/control", {
      componentId: component.id,
      action,
      vm,
      config,
    });
  }

  return (
    <section className="workspace-section">
      <div className="section-heading workspace-heading">
        <div>
          <span className="eyebrow">Deployment workspace</span>
          <h2>{component.name}</h2>
          <p>{component.packageHint}</p>
        </div>
        <div className={`status-badge status-${status}`}>
          <span className="status-dot" /> {statusText(status)}
        </div>
      </div>

      <div className="workspace-grid">
        <div className="panel package-panel">
          <div className="panel-title-row">
            <div>
              <span className="panel-kicker">Connection</span>
              <h3>Ubuntu VM access</h3>
            </div>
            <SettingsIcon className="panel-icon" />
          </div>

          <div className="form-grid compact">
            <label>
              <span>VM IP / host</span>
              <input value={vm.host} onChange={(event) => patchVm("host", event.target.value)} placeholder="192.168.18.216" />
            </label>
            <label>
              <span>SSH user</span>
              <input value={vm.user} onChange={(event) => patchVm("user", event.target.value)} placeholder="aitest" />
            </label>
            <label>
              <span>SSH port</span>
              <input value={vm.port} onChange={(event) => patchVm("port", event.target.value)} />
            </label>
            <label>
              <span>SSH key path</span>
              <input value={vm.sshKeyPath} onChange={(event) => patchVm("sshKeyPath", event.target.value)} placeholder="/keys/safecity_id_rsa" />
            </label>
            <label>
              <span>Release directory</span>
              <input value={vm.releaseDir} onChange={(event) => patchVm("releaseDir", event.target.value)} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={vm.sudo} onChange={(event) => patchVm("sudo", event.target.checked)} />
              <span>Run deployment scripts with sudo</span>
            </label>
          </div>

          <label className="full-field">
            <span>Package scan directories</span>
            <textarea value={vm.scanDirs} onChange={(event) => patchVm("scanDirs", event.target.value)} rows={3} />
          </label>

          <div className="scan-box">
            <div>
              <strong>Packages already on the VM</strong>
              <span>Use local for this VM, or enter SSH details for another VM.</span>
            </div>
            <button className="secondary-button" onClick={scanPackages} disabled={status === "scanning" || status === "running"}>
              <RefreshIcon className={status === "scanning" ? "button-icon spinning" : "button-icon"} />
              {status === "scanning" ? "Scanning..." : "Scan packages"}
            </button>
          </div>

          <div className="package-list">
            {packages.length === 0 ? (
              <div className="package-empty inline">
                <FolderIcon />
                <strong>No packages loaded</strong>
                <span>Scan the VM to select an existing tar package.</span>
              </div>
            ) : (
              packages.map((file) => (
                <label key={file.id} className={selectedPackagePath === file.path ? "package-row selected" : "package-row"}>
                  <input
                    type="radio"
                    name={`${component.id}-package`}
                    value={file.path}
                    checked={selectedPackagePath === file.path}
                    onChange={() => setSelectedPackagePath(file.path)}
                    disabled={status === "running"}
                  />
                  <div className="file-mark">TAR</div>
                  <div className="package-info">
                    <strong>{file.name}</strong>
                    <code>{file.path}</code>
                    <span>{file.size} · Modified {file.modified}</span>
                  </div>
                  <div className="radio-visual"><span /></div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="panel package-panel">
          <div className="panel-title-row">
            <div>
              <span className="panel-kicker">Configuration</span>
              <h3>Values applied during deployment</h3>
            </div>
            <BoltIcon className="panel-icon" />
          </div>

          <div className="form-grid">
            {fieldRows.map((field) => (
              <label key={field.key} className={field.kind === "textarea" ? "full-field" : ""}>
                <span>{field.label}{field.required ? " *" : ""}</span>
                {field.kind === "textarea" ? (
                  <textarea
                    value={config[field.key] ?? ""}
                    onChange={(event) => patchConfig(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    rows={5}
                  />
                ) : field.kind === "select" ? (
                  <select value={config[field.key] ?? ""} onChange={(event) => patchConfig(field.key, event.target.value)}>
                    {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.kind === "password" ? "password" : field.kind === "number" ? "number" : "text"}
                    value={config[field.key] ?? ""}
                    onChange={(event) => patchConfig(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
                {field.help && <em>{field.help}</em>}
              </label>
            ))}
          </div>

          <div className="procedure-list">
            {component.procedure.map((step, index) => (
              <div key={step}><span>{index + 1}</span>{step}</div>
            ))}
          </div>

          <div className="deploy-action-row">
            <div className="selection-summary">
              <span>Selected package</span>
              <strong>{selectedPackage ? selectedPackage.name : "None"}</strong>
            </div>
            <button className="primary-button" onClick={deploy} disabled={status === "running" || status === "scanning"}>
              {status === "running" ? "Running..." : "Save & deploy"}
            </button>
          </div>
        </div>
      </div>

      <div className="panel logs-panel wide-panel">
        <div className="panel-title-row">
          <div>
            <span className="panel-kicker">Operate</span>
            <h3>Docker lifecycle, status, and live logs</h3>
          </div>
          <TerminalIcon className="panel-icon" />
        </div>

        <div className="control-row">
          <button className="secondary-button" onClick={() => runAction("start")} disabled={status === "running"}><BoltIcon className="button-icon" />Start</button>
          <button className="secondary-button" onClick={() => runAction("stop")} disabled={status === "running"}><StopIcon className="button-icon" />Stop</button>
          <button className="secondary-button" onClick={() => runAction("restart")} disabled={status === "running"}><RefreshIcon className="button-icon" />Restart</button>
          <button className="secondary-button" onClick={() => runAction("apply-config")} disabled={status === "running"}><SettingsIcon className="button-icon" />Apply config</button>
          <button className="secondary-button" onClick={() => runAction("status")} disabled={status === "running"}>Status</button>
          <button className="secondary-button" onClick={() => runAction("logs")} disabled={status === "running"}>View logs</button>
        </div>

        <div className="terminal-toolbar">
          <div className="terminal-dots"><span /><span /><span /></div>
          <span>{jobId ? `job-${jobId}.log` : "deployment.log"}</span>
          {logs.length > 0 && <button onClick={() => setLogs([])}>Clear</button>}
        </div>

        <div className="terminal-window" ref={logRef}>
          {logs.length === 0 ? (
            <div className="terminal-placeholder">
              <TerminalIcon />
              <strong>Remote logs will appear here</strong>
              <span>Start a scan, deployment, or lifecycle action.</span>
            </div>
          ) : (
            <div className="terminal-lines">
              {logs.map((line, index) => <div key={`${index}-${line}`} className="terminal-line">{line}</div>)}
              {status === "running" && <div className="terminal-cursor">|</div>}
            </div>
          )}
        </div>

        <div className="log-footer">
          <span>Uses remote SSH commands from the Next.js server process</span>
          {status === "success" && <strong><CheckIcon /> Job completed</strong>}
        </div>
      </div>
    </section>
  );
}
