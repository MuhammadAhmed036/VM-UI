import { spawn } from "child_process";
import type { VmConnectionConfig } from "@/lib/types";

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function sshArgs(vm: VmConnectionConfig, remoteCommand: string) {
  const args = [
    "-p",
    vm.port || "22",
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=10",
  ];

  if (vm.sshKeyPath.trim()) {
    args.push("-i", vm.sshKeyPath.trim());
  }

  args.push(`${vm.user}@${vm.host}`, remoteCommand);
  return args;
}

export function isLocalTarget(vm: VmConnectionConfig) {
  const host = vm.host.trim().toLowerCase();
  return !host || host === "local" || host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function runLocalCommand(command: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", command], { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export function runSshCommand(vm: VmConnectionConfig, remoteCommand: string): Promise<CommandResult> {
  if (isLocalTarget(vm)) return runLocalCommand(remoteCommand);

  return new Promise((resolve, reject) => {
    const child = spawn("ssh", sshArgs(vm, remoteCommand), { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export function runSshScript(
  vm: VmConnectionConfig,
  script: string,
  onLog: (line: string) => void,
): Promise<number | null> {
  if (isLocalTarget(vm)) {
    return new Promise((resolve, reject) => {
      const args = vm.sudo ? ["-lc", "sudo bash -s"] : ["-s"];
      const child = spawn("bash", args, { windowsHide: true });
      let pending = "";

      function append(chunk: Buffer) {
        pending += chunk.toString("utf8");
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const line of lines) onLog(redactSecrets(line));
      }

      child.stdout.on("data", append);
      child.stderr.on("data", append);
      child.on("error", reject);
      child.on("close", (code) => {
        if (pending.trim()) onLog(redactSecrets(pending));
        resolve(code);
      });
      child.stdin.end(script);
    });
  }

  return new Promise((resolve, reject) => {
    const remoteCommand = vm.sudo ? "sudo bash -s" : "bash -s";
    const child = spawn("ssh", sshArgs(vm, remoteCommand), { windowsHide: true });
    let pending = "";

    function append(chunk: Buffer) {
      pending += chunk.toString("utf8");
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) onLog(redactSecrets(line));
    }

    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", reject);
    child.on("close", (code) => {
      if (pending.trim()) onLog(redactSecrets(pending));
      resolve(code);
    });
    child.stdin.end(script);
  });
}

export function redactSecrets(input: string) {
  return input
    .replace(/(nats:\/\/)[^@\s]+@/gi, "$1<redacted>@")
    .replace(/(rtsp:\/\/)[^@\s]+@/gi, "$1<redacted>@")
    .replace(/(PASSWORD|PASS|TOKEN|SECRET)=('[^']*'|"[^"]*"|[^\s]+)/gi, "$1=<redacted>");
}
