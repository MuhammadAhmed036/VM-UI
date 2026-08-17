import { mkdir, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getComponent } from "@/lib/deployment-catalog";
import type { ComponentId, PackageFile, VmConnectionConfig } from "@/lib/types";
import { isLocalTarget } from "@/lib/server/ssh";

export const runtime = "nodejs";

const allowedExtensions = [".tar", ".tar.gz", ".tgz"];

function isAllowedArchive(name: string) {
  return allowedExtensions.some((extension) => name.toLowerCase().endsWith(extension));
}

function packagePatternMatches(pattern: string, filename: string) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(filename);
}

function resolveReleaseDir(vm: VmConnectionConfig) {
  const configured = (vm.releaseDir || vm.scanDirs.split(/\r?\n|,/)[0] || process.env.SAFECITY_RELEASE_DIR || "$HOME/SAFECITY_RELEASE").trim();
  if (configured.startsWith("/")) return configured;

  if (configured.startsWith("$HOME/")) {
    const suffix = configured.slice("$HOME/".length);
    const configuredUser = process.env.SAFECITY_VM_USER;
    if (configuredUser) return path.join("/home", configuredUser, suffix);

    const sudoUser = process.env.SUDO_USER;
    if (sudoUser && existsSync(`/home/${sudoUser}`)) return path.join("/home", sudoUser, suffix);

    const currentUser = process.env.USER;
    if (currentUser && existsSync(`/home/${currentUser}`)) return path.join("/home", currentUser, suffix);

    const home = process.env.HOME;
    if (home && home !== "/root") return path.join(home, suffix);
  }

  return path.resolve(configured.replace(/^\$HOME\/?/, process.env.HOME ? `${process.env.HOME}/` : ""));
}

function containerWritablePath(hostPath: string) {
  const hostRoot = process.env.DEPLOY_MANAGER_HOST_ROOT || process.env.HOST_ROOT;
  if (!hostRoot || !hostPath.startsWith("/")) return hostPath;
  return path.join(hostRoot, hostPath);
}

function packageSnapshot(componentId: ComponentId, filePath: string, sizeBytes: number, modified: Date): PackageFile {
  const name = path.basename(filePath);
  const sizeMb = sizeBytes / 1024 / 1024;
  return {
    id: `${componentId}-upload-${Buffer.from(filePath).toString("base64url")}`,
    name,
    path: filePath,
    size: sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(2)} GB` : `${Math.max(sizeMb, 0.01).toFixed(2)} MB`,
    modified: modified.toISOString().slice(0, 16).replace("T", " "),
    componentId,
  };
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const componentId = String(form.get("componentId") ?? "");
  const vmRaw = String(form.get("vm") ?? "");
  const upload = form.get("file");

  const component = getComponent(componentId);
  if (!component) return NextResponse.json({ error: "Unknown component" }, { status: 400 });
  if (!(upload instanceof File)) return NextResponse.json({ error: "Select a package file first" }, { status: 400 });

  const vm = JSON.parse(vmRaw || "{}") as VmConnectionConfig;
  if (!isLocalTarget(vm)) {
    return NextResponse.json({ error: "Package upload is available for local VM target only. Use Scan packages for remote SSH targets." }, { status: 400 });
  }

  const filename = path.basename(upload.name);
  if (!isAllowedArchive(filename)) {
    return NextResponse.json({ error: "Only .tar, .tar.gz, and .tgz packages can be uploaded" }, { status: 400 });
  }

  const matchesComponent = component.packagePatterns.some((pattern) => packagePatternMatches(pattern, filename));
  if (!matchesComponent) {
    return NextResponse.json({ error: `This file does not match ${component.name}'s expected package name` }, { status: 400 });
  }

  const releaseDir = resolveReleaseDir(vm);
  const writableReleaseDir = containerWritablePath(releaseDir);
  await mkdir(writableReleaseDir, { recursive: true });

  const destination = path.join(releaseDir, filename);
  const writableDestination = containerWritablePath(destination);
  const bytes = Buffer.from(await upload.arrayBuffer());
  await writeFile(writableDestination, bytes, { mode: 0o644 });

  const info = await stat(writableDestination);
  return NextResponse.json({ package: packageSnapshot(component.id, destination, info.size, info.mtime) });
}
