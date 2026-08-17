import type { ComponentId, JobSnapshot } from "@/lib/types";

type JobStatus = JobSnapshot["status"];

interface MutableJob extends JobSnapshot {
  status: JobStatus;
}

const globalJobs = globalThis as typeof globalThis & {
  __deployManagerJobs?: Map<string, MutableJob>;
};

const jobs = globalJobs.__deployManagerJobs ?? new Map<string, MutableJob>();
globalJobs.__deployManagerJobs = jobs;

export function createJob(componentId: ComponentId) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const job: MutableJob = {
    id,
    componentId,
    status: "running",
    startedAt: new Date().toISOString(),
    logs: [],
  };
  jobs.set(id, job);
  return job;
}

export function appendJobLog(id: string, line: string) {
  const job = jobs.get(id);
  if (!job) return;
  const stamp = new Date().toISOString().slice(11, 19);
  job.logs.push(`[${stamp}] ${line}`);
  if (job.logs.length > 1500) job.logs.splice(0, job.logs.length - 1500);
}

export function finishJob(id: string, status: JobStatus, exitCode: number | null) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = status;
  job.exitCode = exitCode;
  job.finishedAt = new Date().toISOString();
}

export function getJob(id: string): JobSnapshot | null {
  const job = jobs.get(id);
  return job ? { ...job, logs: [...job.logs] } : null;
}
