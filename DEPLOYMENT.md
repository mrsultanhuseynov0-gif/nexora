# NEXORA — Free Production Deployment

This guide deploys NEXORA **for free** with minimal manual work.

## Stack detected

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML / CSS / JS (multi-page), PWA |
| Backend | Node.js + Express |
| Database | SQLite (`better-sqlite3`) — auto-seeds from `data/*.json` |
| Images | Remote Unsplash / Wikimedia URLs + local SVG fallbacks |

No React/Next build step. The Express app serves **both** the API and the storefront (same origin).

---

## Recommended free architecture

### Option A — Best (simplest, least breakage): **Render monolith**

```
Browser → https://your-app.onrender.com
            ├── /              storefront (static)
            ├── /api/*         Express API
            └── SQLite         server/data/nexora.db
```

**Why:** Same-origin cookies/API, CSP `'self'`, Business Panel, PDF downloads — all work without CORS gymnastics.

| Piece | Free platform |
|-------|----------------|
| Frontend + Backend | [Render](https://render.com) Web Service |
| Database | SQLite on instance disk (demo-grade; resets on redeploy) |
| Images | Existing CDN URLs (Cloudinary optional later) |

> **Supabase Postgres:** schema stub is in `supabase/schema.sql`. Runtime still uses SQLite so all features keep working on free tier without a full async `pg` rewrite. Migrate later when you need durable multi-instance data.

### Option B — Split CDN frontend

```
Vercel / Cloudflare Pages  →  static HTML/CSS/JS
Render                     →  Express API (+ optional same static)
```

1. Deploy API on Render (as below).
2. Set `CORS_ORIGINS` to your frontend origin(s).
3. Edit `config.static.json` → `"apiBase": "https://your-api.onrender.com"`.
4. Deploy repo root to Vercel or Cloudflare Pages.
5. Optionally set `<meta name="nexora-api-base" content="https://...">` in HTML.

---

## 1) Deploy API + storefront on Render (Option A)

1. Push this repo to GitHub / GitLab.
2. Render Dashboard → **New → Blueprint** → select repo (`render.yaml`),  
   **or** **New → Web Service**:
   - **Root Directory:** `server`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Health check:** `/api/health`
3. Environment variables:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `JWT_SECRET` | long random string (Render can generate) |
| `JWT_EXPIRES` | `8h` |
| `CORS_ORIGINS` | `*` (or lock to your domain) |
| `PUBLIC_SITE_URL` | `https://YOUR-SERVICE.onrender.com` |
| `TRUST_PROXY` | `1` |

4. Deploy. Open:
   - `https://YOUR-SERVICE.onrender.com/api/health`
   - `https://YOUR-SERVICE.onrender.com/`

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| Customer | `demo@nexora.az` | `Demo1234` |
| Admin | `admin@nexora.az` | `Admin1234` |
| Business | `business@nexora.az` | `Business1234` |

### Free-tier notes (Render)

- Cold starts after idle (~50s first request).
- **Ephemeral disk:** SQLite resets when the service redeploys — catalog re-seeds automatically from `data/*.json`. Fine for demos; not for real customer data.
- For durable free SQL later: Supabase → apply `supabase/schema.sql` → then migrate the Node data layer (future work).

---

## 2) Optional: Frontend on Vercel

1. Import the same Git repo into [Vercel](https://vercel.com).
2. **Framework Preset:** Other / static.
3. **Root:** repository root (not `server`).
4. Edit `config.static.json`:

```json
{
  "apiBase": "https://YOUR-SERVICE.onrender.com",
  "siteUrl": "https://YOUR-PROJECT.vercel.app",
  "env": "production"
}
```

5. On Render set:

```
CORS_ORIGINS=https://YOUR-PROJECT.vercel.app
PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com
PUBLIC_SITE_URL=https://YOUR-PROJECT.vercel.app
```

`vercel.json` already sets security headers and maps `/config.json` → `config.static.json`.

---

## 3) Optional: Frontend on Cloudflare Pages

1. Pages → Connect repo → build command empty → output directory `/` (root).
2. Ensure `public/_redirects` is applied (or copy rule into Pages **Redirects**):  
   `/config.json /config.static.json 200`
3. Same `config.static.json` + Render `CORS_ORIGINS` as Vercel.

---

## Custom domain (öz domeniniz)

Bəli — öz domeni (məs. `nexora.az` / `www.nexora.az`) pulsuz planlarda da bağlanır.

### A) Monolith Render (tövsiyə)

1. Render → servisiniz → **Settings → Custom Domains → Add**
2. Domeni yazın: `nexora.az` və ya `www.nexora.az`
3. DNS provayderinizdə (GoDaddy, Namecheap, Cloudflare DNS, …):

| Tip | Name / Host | Value (Render göstərəcək) |
|-----|-------------|---------------------------|
| **CNAME** | `www` | `YOUR-SERVICE.onrender.com` |
| **A** və ya **ALIAS/ANAME** | `@` (kök domen) | Render-in verdiyi IP / target |

4. SSL Render avtomatik verir (bir neçə dəqiqə–saat çəkə bilər).
5. Env yeniləyin:

```
PUBLIC_SITE_URL=https://nexora.az
PUBLIC_API_URL=
CORS_ORIGINS=https://nexora.az,https://www.nexora.az
```

6. İstəyə görə `www` → kök (və ya əksinə) redirect Render / DNS-də.

### B) Frontend Vercel / Cloudflare Pages + API Render

- **Sayt domeni** → Vercel/Pages → Domains  
- **API domeni** (opsional) → məs. `api.nexora.az` → Render Custom Domain  
- Sonra:

```
PUBLIC_SITE_URL=https://nexora.az
PUBLIC_API_URL=https://api.nexora.az
CORS_ORIGINS=https://nexora.az,https://www.nexora.az
```

və `config.static.json` → `"apiBase": "https://api.nexora.az"`.

### Qeyd

- DNS yayılması 5 dəq–48 saat çəkə bilər.
- Kök domen (`nexora.az`) üçün bəzi registrarlar yalnız A record dəstəkləyir — Render panelindəki dəqiq dəyərlərə baxın.
- Domenin özü (alış) pulludur; **bağlama** Render/Vercel/Cloudflare-də free-dir.

---

## 4) Local production-like run

```bash
cd server
cp .env.example .env
# set HOST=0.0.0.0 and a real JWT_SECRET for prod-like tests
npm install
npm start
```

Open `http://127.0.0.1:8787/api/health`.

Root helper:

```bash
npm start   # from repo root → starts server
npm run icons
```

---

## Environment variables (reference)

See `.env.example` and `server/.env.example`.

| Variable | Required | Purpose |
|----------|----------|---------|
| `HOST` | prod: yes | Must be `0.0.0.0` on Render |
| `PORT` | no | Render injects automatically |
| `JWT_SECRET` | **yes** | Sign auth tokens |
| `PUBLIC_SITE_URL` | recommended | Absolute sitemap / OG |
| `PUBLIC_API_URL` | split deploy | Returned in `/config.json` |
| `CORS_ORIGINS` | split deploy | Allowed browser origins |
| `DATABASE_PATH` | optional | Custom SQLite file location |
| `DATABASE_URL` | future | Supabase Postgres (not wired yet) |

---

## Production checklist

- [x] No production dependency on hardcoded `127.0.0.1:8787` (dev fallback only on localhost)
- [x] `/config.json` for runtime API base
- [x] CORS configurable
- [x] Compression + security headers
- [x] `robots.txt`, `sitemap.xml`, favicon, PWA icons, Open Graph on home
- [x] `render.yaml`, `vercel.json`, `.gitignore`, `.env.example`
- [ ] Set strong `JWT_SECRET` in the host dashboard
- [ ] After first Render URL is known, set `PUBLIC_SITE_URL`
- [ ] For split frontend, update `config.static.json` `apiBase`

---

## Images / Cloudinary

Not required for launch. Product images already load from Unsplash/Wikimedia (allowed in CSP).  
If you later upload merchant assets, create a free Cloudinary account and store HTTPS URLs in admin (image URL fields) — or set `CLOUDINARY_*` when you add an upload route.

---

## Verify after deploy

```bash
curl -s https://YOUR-SERVICE.onrender.com/api/health
curl -s https://YOUR-SERVICE.onrender.com/config.json
curl -sI https://YOUR-SERVICE.onrender.com/
```

Browser checks:

1. Home page loads, categories/products appear  
2. Login `demo@nexora.az` / `Demo1234`  
3. Account → Digital Twin / Warranty  
4. Office Builder → PDF Offer (API online)  
5. Images load (Unsplash)  
6. `/robots.txt` and `/sitemap.xml` respond  

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Service won’t bind | `HOST=0.0.0.0` |
| API offline on Vercel site | Fix `config.static.json` `apiBase` + Render `CORS_ORIGINS` |
| CSP blocks API | Ensure API is `https:` and listed via meta / config (CSP allows `https:`) |
| Empty catalog after redeploy | Expected on free disk — seed runs automatically |
| `better-sqlite3` build fail | Use Render native Node environment (not broken Alpine without build tools) |

---

## What was intentionally not done

- **Full Supabase runtime migration** — would require rewriting every sync SQLite call to async `pg` and risk breaking features. Schema stub is ready in `supabase/schema.sql`.
- **Cloudinary upload pipeline** — not needed; CDN URLs already work.
