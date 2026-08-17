import { NextRequest, NextResponse } from "next/server";
import { getComponent } from "@/lib/deployment-catalog";
import type { PackageFile, VmConnectionConfig } from "@/lib/types";
import { runSshCommand } from "@/lib/server/ssh";
import { sh } from "@/lib/server/shell";

export const runtime = "nodejs";

interface PackageScanBody {
  componentId: string;
  vm: VmConnectionConfig;
}

function parseDirs(vm: VmConnectionConfig, fallback: string[]) {
  const raw = vm.scanDirs.trim() || fallback.join("\n");
  return raw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PackageScanBody;
  const component = getComponent(body.componentId);

  if (!component) {
    return NextResponse.json({ error: "Unknown component" }, { status: 400 });
  }

  const dirs = parseDirs(body.vm, component.defaultScanDirs);
  const patterns = component.packagePatterns.length ? component.packagePatterns : ["*.tar", "*.tar.gz", "*.tgz"];
  const findNames = patterns.map((pattern) => `-name ${sh(pattern)}`).join(" -o ");
  const safeDirs = dirs.map((dir) => sh(dir)).join(" ");
  const command = `bash -lc ${sh(`
set -e
for d in ${safeDirs}; do
  eval "expanded=\\"$d\\""
  [ -d "$expanded" ] || continue
  find "$expanded" -maxdepth 1 -type f \\( ${findNames} \\) -printf '%p\\t%s\\t%TY-%Tm-%Td %TH:%TM\\n'
done | head -100
`)}`;

  const result = await runSshCommand(body.vm, command);
  if (result.code !== 0) {
    return NextResponse.json({ error: result.stderr || "Package scan failed" }, { status: 500 });
  }

  const seenNames = new Set<string>();
  const packages: PackageFile[] = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const [path, bytes = "0", modified = ""] = line.split("\t");
      const name = path.split("/").pop() || path;
      if (seenNames.has(name)) return [];
      seenNames.add(name);
      const sizeMb = Number(bytes) / 1024 / 1024;
      return [{
        id: `${component.id}-${index}-${Buffer.from(path).toString("base64url")}`,
        name,
        path,
        size: sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(2)} GB` : `${Math.max(sizeMb, 0.01).toFixed(2)} MB`,
        modified,
        componentId: component.id,
      }];
    });

  return NextResponse.json({ packages });
}
