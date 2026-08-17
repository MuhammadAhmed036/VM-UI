# Deployment Manager UI

Next.js-based deployment management system for SafeCity Ubuntu VM packages.

The app scans configured directories on the Ubuntu VM for existing `.tar`, `.tar.gz`, and related release files, lets an operator select a package, collects the required configuration through the UI, then runs the deployment and Docker lifecycle commands over SSH from the server-side API.

## Implemented Workflow

- Main, Consumer, and UI sections
- Main modules for Complete Stack, Streaming Server, NATS / JetStream, and Golden RTSP Engine
- Consumer page for YOLO Stage2 configuration and deployment
- UI page for SafeCity Dashboard deployment as the last section
- Remote package scanning from configurable VM directories
- Component-specific configuration forms based on the supplied deployment procedures
- Server-side deployment jobs with live log polling
- Start, stop, restart, apply configuration, status, and logs actions
- Dashboard `.env` updates use `update-env.sh` when available
- YOLO configuration apply recreates dashboard/helper/worker without touching PostgreSQL
- Dockerized production runtime with `openssh-client`

## Local VM Access

When this app is running on the same Ubuntu VM that contains `~/SAFECITY_RELEASE`, keep the target value as:

```text
local
```

In local mode the app scans package files directly from the VM filesystem. No SSH user or SSH key is required for package scanning.

For deployment actions that change `/opt`, systemd, routes, or Docker, run the app with an account that can execute the required sudo commands.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Run With Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

## Operator Flow

1. Open the web UI.
2. Select Main, Consumer, or UI.
3. Select the deployment module.
4. Keep VM IP / host as `local` when the UI is running on the same Ubuntu VM.
5. Keep the scan directory as `$HOME/SAFECITY_RELEASE` when packages are already there.
6. Scan packages already present on the Ubuntu VM.
7. Select the required package.
8. Fill the configuration form.
9. Click Save & deploy.
10. Watch live deployment logs and final status.
11. Use Start, Stop, Restart, Apply config, Status, or View logs after deployment.

Main contains only the three core modules: Streaming Server, Golden RTSP Engine, and NATS / JetStream. YOLO stays under Consumer, including its PostgreSQL dependency.

## Validation

The implementation validates required UI fields before starting a job. The remote scripts also fail closed with `set -Eeuo pipefail` and verify expected files/directories before continuing.

Project checks:

```bash
npm run lint
npm run build
```
