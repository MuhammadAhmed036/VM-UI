# Deploy Manager UI Offline Website Deployment

This package installs the Deploy Manager UI on an Ubuntu VM without internet.

## What Is Inside

- `images/deploy-manager-ui.tar` - prebuilt website Docker image
- `docker-debs/` - offline Docker Engine and Docker Compose packages
- `docker-compose.yml` - runtime configuration
- `install-offline.sh` - one-command offline installer
- `MANIFEST.sha256` - checksum verification

## Copy To VM

From the machine that has this tar file:

```bash
scp deploy-manager-ui-offline.tar.gz aitest@192.168.18.205:/home/aitest/
```

When SSH asks for the password, enter the VM user's password.

## Install On Offline VM

Login:

```bash
ssh aitest@192.168.18.205
```

When SSH asks for the password, enter the VM user's password.

Run:

```bash
cd /home/aitest
tar -xzf deploy-manager-ui-offline.tar.gz
cd deploy-manager-ui-offline
sudo SAFECITY_VM_USER="aitest" ./install-offline.sh
```

## Open Website

```text
http://192.168.18.205:3000
```

## Custom Port

```bash
sudo APP_PORT=3001 SAFECITY_VM_USER="aitest" ./install-offline.sh
```

Open:

```text
http://192.168.18.205:3001
```

## Package Folder On VM

Default release package folder:

```text
/home/aitest/SAFECITY_RELEASE
```

The UI can scan this folder or upload packages into it.

## Useful Commands

Check website container:

```bash
sudo docker ps --filter name=deploy-manager-ui
```

View website logs:

```bash
sudo docker logs -f deploy-manager-ui
```

Restart website:

```bash
cd /home/aitest/deploy-manager-ui-offline
sudo docker compose restart
```

Stop website:

```bash
cd /home/aitest/deploy-manager-ui-offline
sudo docker compose down
```

Start website again:

```bash
cd /home/aitest/deploy-manager-ui-offline
sudo docker compose up -d --pull never
```
