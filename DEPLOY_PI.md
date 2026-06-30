# CloudSpace – Raspberry Pi 5 / CasaOS Deployment Guide

---

## What you need

| Item | Notes |
|------|-------|
| Raspberry Pi 5 | 4 GB or 8 GB |
| CasaOS installed | `curl -fsSL https://get.casaos.io | sudo bash` |
| Storage | SD card (default), USB drive, SSD via USB 3, or NVMe via PCIe hat |
| Your Mac on the same network | To copy the project over |

---

## Step 1 — Find your Pi's IP address

On the Pi terminal (or via CasaOS dashboard → Settings → Network):

```bash
hostname -I
# example output: 192.168.1.42
```

Keep this IP handy — you'll use it throughout this guide.

---

## Step 2 — Decide where to store your files

CloudSpace needs two folders on the Pi:

| Folder | What goes there |
|--------|----------------|
| `STORAGE_PATH` | All uploaded files (videos, photos, PDFs …) |
| `POSTGRES_DATA_PATH` | The database |

**Choose the right location for your setup:**

### Option A — SD card (simplest, not ideal for heavy writes)
```
STORAGE_PATH=/DATA/AppData/cloudspace/files
POSTGRES_DATA_PATH=/DATA/AppData/cloudspace/db
```

### Option B — USB drive or external SSD (recommended)
First, find the drive name and mount it:
```bash
lsblk                        # find your drive, e.g. /dev/sda1
sudo mkdir -p /mnt/mydrive
sudo mount /dev/sda1 /mnt/mydrive

# Make it auto-mount on reboot:
echo "/dev/sda1 /mnt/mydrive ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
```
Then use:
```
STORAGE_PATH=/mnt/mydrive/cloudspace/files
POSTGRES_DATA_PATH=/mnt/mydrive/cloudspace/db
```

### Option C — NVMe SSD (best performance, needs PCIe hat)
Same as Option B but the drive will show as `/dev/nvme0n1p1`.
```
STORAGE_PATH=/mnt/nvme/cloudspace/files
POSTGRES_DATA_PATH=/mnt/nvme/cloudspace/db
```

---

## Step 3 — Copy the project to your Pi

On **your Mac**, run:

```bash
# Replace 192.168.1.42 with your Pi's actual IP
scp -r "/Users/murat/Desktop/Documents/Software Projects/cloudspace" \
    pi@192.168.1.42:/DATA/AppData/cloudspace
```

> Default CasaOS user is `casaos` on some installs; try `casaos@192.168.1.42` if `pi` fails.
> If SSH key isn't set up yet: `ssh-copy-id pi@192.168.1.42`

---

## Step 4 — Configure on the Pi

SSH into your Pi:

```bash
ssh pi@192.168.1.42
cd /DATA/AppData/cloudspace
```

Copy and edit the environment file:

```bash
cp .env.example .env
nano .env
```

Set these values (minimum required changes):

```dotenv
# ── Storage (choose your path from Step 2) ──────────────────────────────────
STORAGE_PATH=/DATA/AppData/cloudspace/files
POSTGRES_DATA_PATH=/DATA/AppData/cloudspace/db

# ── Security (CHANGE THESE) ──────────────────────────────────────────────────
POSTGRES_PASSWORD=MySuperSecretDBPassword123
SECRET_KEY=a-very-long-random-string-change-this-now

# ── Port (change if 8080 is taken) ──────────────────────────────────────────
APP_PORT=8080
```

Save: `Ctrl+O → Enter → Ctrl+X`

Create the storage directories:

```bash
mkdir -p $STORAGE_PATH $POSTGRES_DATA_PATH 2>/dev/null || true
# Or use the paths directly:
mkdir -p /DATA/AppData/cloudspace/files
mkdir -p /DATA/AppData/cloudspace/db
```

---

## Step 5 — Build and start

```bash
cd /DATA/AppData/cloudspace
docker compose up -d --build
```

> First build takes **10–20 minutes** on Pi 5 (compiling Python packages + React).  
> Subsequent starts are instant (images are cached).

Watch the build progress:
```bash
docker compose logs -f
```

Check everything is running:
```bash
docker compose ps
```

You should see three containers: `cloudspace-db` (healthy), `cloudspace-backend`, `cloudspace-frontend`.

---

## Step 6 — Open CloudSpace

On any device on your local network:

```
http://192.168.1.42:8080
```

Register your account and start uploading!

---

## Step 7 — Add to CasaOS Dashboard (optional)

So CloudSpace appears as a tile in CasaOS:

1. Open CasaOS: `http://192.168.1.42`
2. Go to **App Store → ⋮ menu (top-right) → Custom Install**
3. Click **Import** and select `/DATA/AppData/cloudspace/casaos-compose.yml`
4. Fill in your passwords/secrets in the CasaOS form
5. Click **Install**

> CasaOS will show CloudSpace as an app tile with a direct link.

---

## Step 8 — Access from the internet

### Easiest: Cloudflare Tunnel (free, no port forwarding needed)

1. Create a free account at [cloudflare.com](https://cloudflare.com) and add your domain.

2. Install `cloudflared` on the Pi:
```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

3. Log in and create a tunnel:
```bash
cloudflared tunnel login
cloudflared tunnel create cloudspace
```

4. Create the config file:
```bash
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: cloudspace
credentials-file: /home/pi/.cloudflared/<YOUR-TUNNEL-ID>.json

ingress:
  - hostname: cloud.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404
EOF
```

5. Route DNS and start:
```bash
cloudflared tunnel route dns cloudspace cloud.yourdomain.com
cloudflared service install
sudo systemctl enable --now cloudflared
```

Your app is now live at `https://cloud.yourdomain.com` with automatic HTTPS.

---

### Alternative: Nginx Proxy Manager (already in CasaOS App Store)

1. Install **Nginx Proxy Manager** from the CasaOS App Store.
2. Forward ports **80** and **443** to your Pi on your router.
3. In NPM, add a Proxy Host:
   - Domain: `cloud.yourdomain.com`
   - Forward: `cloudspace-frontend` port `80` (or `localhost:8080`)
   - Enable **SSL** → Request Let's Encrypt certificate → Force HTTPS ✓

---

## Changing storage later

To move your files to a new drive after the app is running:

```bash
# 1. Stop the app
cd /DATA/AppData/cloudspace
docker compose down

# 2. Copy files to new location
sudo rsync -av /DATA/AppData/cloudspace/files/ /mnt/newdrive/cloudspace/files/
sudo rsync -av /DATA/AppData/cloudspace/db/    /mnt/newdrive/cloudspace/db/

# 3. Update .env
nano .env
# Set STORAGE_PATH and POSTGRES_DATA_PATH to the new paths

# 4. Restart
docker compose up -d
```

---

## Useful commands

```bash
# View live logs
docker compose logs -f

# Stop the app
docker compose down

# Update after code changes
docker compose up -d --build

# Check disk usage of your storage
du -sh /DATA/AppData/cloudspace/files
du -sh /DATA/AppData/cloudspace/db

# Backup files
rsync -av /DATA/AppData/cloudspace/files/ /mnt/backup/cloudspace-files/

# Restart a single service
docker compose restart backend
```
