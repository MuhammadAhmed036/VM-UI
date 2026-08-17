# SafeCity Deploy Manager UI Offline Install

This folder is a self-contained offline runtime bundle for the Deploy Manager UI.

It contains:

- `images/deploy-manager-ui.tar` - prebuilt Docker image for the website
- `docker-compose.yml` - runtime compose file
- `docker-debs/` - offline Docker Engine packages when created on Ubuntu
- `install-offline.sh` - installer for an air-gapped Ubuntu VM
- `MANIFEST.sha256` - bundle checksum manifest

## Build The Offline Bundle

Run this on an internet-connected Ubuntu machine with Docker installed:

```bash
cd VM-UI
chmod +x scripts/offline/build-offline-bundle.sh
./scripts/offline/build-offline-bundle.sh
```

Copy the output folder to the target VM:

```bash
scp dist/deploy-manager-ui-offline.tar.gz user@VM_IP:/home/user/
```

## Install On Offline Ubuntu VM

On the target VM:

```bash
tar -xzf deploy-manager-ui-offline.tar.gz
cd deploy-manager-ui-offline
sudo SAFECITY_VM_USER="$USER" ./install-offline.sh
```

Open:

```text
http://VM_IP:3000
```

## Custom Port Or Release Directory

```bash
sudo APP_PORT=3001 \
  SAFECITY_VM_USER="$USER" \
  SAFECITY_RELEASE_DIR="/home/$USER/SAFECITY_RELEASE" \
  ./install-offline.sh
```

## Notes

- No internet is required on the target VM.
- If Docker is missing, the installer uses local `.deb` files from `docker-debs/`.
- The UI container runs in host-control mode so `local` deployments operate on the VM host, not inside the UI container.
- Keep package scan directory as `$HOME/SAFECITY_RELEASE` or set an absolute path such as `/home/user/SAFECITY_RELEASE`.
