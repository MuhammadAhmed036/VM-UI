import { NextRequest, NextResponse } from "next/server";
import { getComponent } from "@/lib/deployment-catalog";
import { buildControlScript } from "@/lib/server/deployment-scripts";
import { appendJobLog, createJob, finishJob } from "@/lib/server/jobs";
import { runSshScript } from "@/lib/server/ssh";
import type { ComponentId, VmConnectionConfig } from "@/lib/types";

export const runtime = "nodejs";

interface ControlBody {
  componentId: ComponentId;
  action: "start" | "stop" | "restart" | "apply-config" | "status" | "logs";
  vm: VmConnectionConfig;
  config: Record<string, string>;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ControlBody;
  const component = getComponent(body.componentId);
  if (!component) return NextResponse.json({ error: "Unknown component" }, { status: 400 });
  if (!body.vm?.host || !body.vm?.user) {
    return NextResponse.json({ error: "VM IP/host and SSH user are required" }, { status: 400 });
  }

  const job = createJob(body.componentId);
  appendJobLog(job.id, `Service action queued: ${body.action}`);
  const script = buildControlScript(body.componentId, body.action, body.config ?? {});

  void runSshScript(body.vm, script, (line) => appendJobLog(job.id, line))
    .then((code) => {
      appendJobLog(job.id, `Remote action exited with code ${code}`);
      finishJob(job.id, code === 0 ? "success" : "failed", code);
    })
    .catch((err: Error) => {
      appendJobLog(job.id, err.message);
      finishJob(job.id, "failed", null);
    });

  return NextResponse.json({ jobId: job.id });
}
