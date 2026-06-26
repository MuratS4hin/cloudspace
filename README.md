# CloudSpace

CloudSpace is a self-hosted cloud storage app built with Python (FastAPI), React, and PostgreSQL.

You can:
- Register/login
- Upload files (videos, images, PDFs, and common file types)
- Preview supported files inside the app
- Download and delete files

## Stack

- Backend: FastAPI + SQLAlchemy + JWT auth
- Frontend: React (Vite build served by Nginx)
- Database: PostgreSQL
- Deployment: Docker Compose (CasaOS-friendly)

## 1) Run locally with Docker

From project root:

```bash
cp .env.example .env
docker compose up -d --build
```

Open: `http://YOUR_HOST_IP:8080`

## 2) Deploy on CasaOS (Raspberry Pi)

### Option A: Import this compose directly

1. Copy this whole project to your Pi (for example `/DATA/AppData/cloudspace`).
2. In CasaOS, open **Containers** > **Compose** > **Import**.
3. Select the `docker-compose.yml` from this project.
4. Set environment values from `.env.example` (especially `POSTGRES_PASSWORD` and `SECRET_KEY`).
5. Start the stack.

Then open: `http://PI_LOCAL_IP:8080`

### Option B: Run from terminal on Pi

```bash
cd /DATA/AppData/cloudspace
cp .env.example .env
docker compose up -d --build
```

## 3) Access via Internet (recommended approach)

Use a reverse proxy + TLS, or a tunnel.

### Fast path: Cloudflare Tunnel

1. Add your domain to Cloudflare.
2. Install `cloudflared` on Pi.
3. Create a tunnel that forwards `https://cloud.yourdomain.com` -> `http://localhost:8080`.
4. Enable Cloudflare Access if you want extra zero-trust login in front of CloudSpace.

This gives secure HTTPS remote access without opening router ports.

### Alternative: Nginx Proxy Manager + Port Forwarding

1. Run Nginx Proxy Manager in CasaOS.
2. Forward router ports 80/443 to Pi.
3. Create proxy host `cloud.yourdomain.com` -> `http://cloudspace-frontend:80` or `http://PI_LOCAL_IP:8080`.
4. Enable Let's Encrypt certificate.

## Development mode (without Docker)

### Backend

For local (non-Docker) backend run, make sure PostgreSQL is running on your machine (`localhost:5432`) with database/user/password matching `backend/.env`.
The hostname `db` works only inside Docker Compose network.

If you do not have local PostgreSQL installed, you can run only Postgres in Docker:

```bash
cd ..
docker compose up -d db
cd backend
```

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev URL: `http://localhost:5173` (API proxied to backend).

## Important production notes

- Set a strong `SECRET_KEY` in `.env`.
- Use strong `POSTGRES_PASSWORD`.
- Keep persistent Docker volumes (`postgres_data`, `storage_data`) for backups.
- Put app behind HTTPS for internet access.
- This is an MVP; for advanced use, add email verification, password reset, quotas, sharing links, and antivirus scanning.
