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

## SSH Access

The browser never runs SSH directly. The Next.js server process runs SSH commands, so the deployment manager host/container must have non-interactive SSH access to the Ubuntu VM.

Recommended setup:

```bash
ssh-keygen -t ed25519 -f ./ssh-keys/safecity_deploy
ssh-copy-id -i ./ssh-keys/safecity_deploy.pub aitest@192.168.18.216
```

When running in Docker, mount keys into `/keys` and enter `/keys/safecity_deploy` in the UI.

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
4. Enter VM SSH details and scan directories.
5. Scan packages already present on the Ubuntu VM.
6. Select the required package.
7. Fill the configuration form.
8. Click Save & deploy.
9. Watch live deployment logs and final status.
10. Use Start, Stop, Restart, Apply config, Status, or View logs after deployment.

## Validation

The implementation validates required UI fields before starting a job. The remote scripts also fail closed with `set -Eeuo pipefail` and verify expected files/directories before continuing.

Project checks:

```bash
npm run lint
npm run build
```
