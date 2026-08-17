import { NextRequest, NextResponse } from "next/server";
import { getComponent } from "@/lib/deployment-catalog";
import type { DeploymentRequest } from "@/lib/types";
import { buildDeploymentScript } from "@/lib/server/deployment-scripts";
import { appendJobLog, createJob, finishJob } from "@/lib/server/jobs";
import { runSshScript } from "@/lib/server/ssh";

export const runtime = "nodejs";

function validateRequest(body: DeploymentRequest) {
  const component = getComponent(body.componentId);
  if (!component) return "Unknown component";
  if (!body.vm?.host || !body.vm?.user) return "VM IP/host and SSH user are required";
  if (!body.packagePath) return "A package must be selected";

  for (const field of component.fields) {
    if (field.required && !String(body.config?.[field.key] ?? "").trim()) {
      return `${field.label} is required`;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as DeploymentRequest;
  const error = validateRequest(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const job = createJob(body.componentId);
  const script = buildDeploymentScript(body);

  appendJobLog(job.id, "Deployment job queued");
  void runSshScript(body.vm, script, (line) => appendJobLog(job.id, line))
    .then((code) => {
      appendJobLog(job.id, `Remote job exited with code ${code}`);
      finishJob(job.id, code === 0 ? "success" : "failed", code);
    })
    .catch((err: Error) => {
      appendJobLog(job.id, err.message);
      finishJob(job.id, "failed", null);
    });

  return NextResponse.json({ jobId: job.id });
}
