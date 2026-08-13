# BloxFarm Tracker

A small web app for a Blox Fruits farming service:

- **Customers** can search by Roblox username and **view** their order progress (read-only).
- **Admin** logs in with a password and can **add / edit / delete** orders and progress steps.
- A **Prices** page shows all Blox Fruits item prices and your service rates (edit the tables in `public/prices.html`).

Zero dependencies — just Node.js. Data is stored in JSON files under `data/` by default, or **optionally in a free Supabase database** so it survives every redeploy (recommended if you host on Render).

## Run it

```bash
node server.js
```

Then open:

| Page | URL |
|---|---|
| Customer tracking | http://localhost:3000/ |
| Admin dashboard | http://localhost:3000/admin |
| Price list | http://localhost:3000/prices |

Default admin password: **`admin123`** (printed on first run).

## Change the admin password

Edit `data/config.json` (created on first run) and set `adminPassword`, then restart the server.
Or start with an environment variable (doesn't touch the file):

```bash
ADMIN_PASSWORD="your-strong-password" node server.js
```

⚠️ **Do not expose the server publicly without changing the password.** Use a long, random one.

## Deploy on Render

1. Create a new **Web Service** on Render and connect the GitHub repo (`1makam1/Farm-Service`).
2. Settings:
   - **Build command:** leave empty (the app has no dependencies, no `npm install` needed)
   - **Start command:** `HOST=0.0.0.0 node server.js`
3. Environment variables (in the Render dashboard):
   - `ADMIN_PASSWORD` — your strong admin password (set it **before the first start**)
   - `HOST` = `0.0.0.0`
   - `DATA_DIR` = `/var/data` (only if you attach a persistent disk, see below)
4. **Data persistence — pick one:** Render's filesystem is wiped on every deploy. Either:
   - **Recommended — Supabase (free):** follow the "Use a database (Supabase)" section below, then add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Render's environment variables. Data lives in the cloud and survives every deploy.
   - **Persistent disk (paid Starter+):** attach a **Persistent Disk** (e.g. 1 GB mounted at `/var/data`) and set `DATA_DIR=/var/data`.
   - **Free tier only:** data resets whenever the service restarts/redeploys — fine for testing.
5. The app listens on the `PORT` Render provides automatically.

## Use a database (Supabase)

Optional but recommended: store customers, items and services in Supabase so data survives redeploys and is shared across all your machines.

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`scripts/setup-supabase.sql`](scripts/setup-supabase.sql), and run it (creates one small `kv_store` table).
3. Copy your credentials from **Project Settings → API** (or Dashboard → Connect):
   - `SUPABASE_URL` — e.g. `https://xyzcompany.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — the **service_role** key (Project Settings → API → service_role secret). Treat it like a password — anyone with it can read/write all your data.
4. Start the server with those two variables set (they override local file storage):

```bash
SUPABASE_URL="https://your-project.supabase.co" SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" node server.js
```

That's it. On first connect, existing local `data/*.json` files are **migrated automatically** into Supabase (the old demo order is never migrated). Afterwards every change is written straight to Supabase.

- Your three stores live as JSONB rows (`customers`, `items`, `services`) in the `kv_store` table — no schema changes needed if the app's data model grows.
- Back out anytime: just unset the two env vars and restart — the app falls back to local `data/` files.
- Only the service_role key is supported (the anon key is too restricted for this).

## Ports / hosting

- Change port: `PORT=8080 node server.js` (default 3000).
- To allow other people to reach it, run with `HOST=0.0.0.0` and open the port in your firewall / router:

```bash
HOST=0.0.0.0 node server.js
```

For a public site, deploy the folder to any Node host (Render, Railway, Fly.io, a VPS, etc.) — the app has no dependencies, so `npm install` isn't needed. Set `ADMIN_PASSWORD` there and note that data is stored locally on that server (add a volume/disk for the `data/` folder).

## Data

With **no Supabase env vars**, everything is local JSON files:

- `data/accounts.json` — your orders. Edit it only while the server is stopped.
- `data/items.json` — the item catalog (manage from Admin → Items).
- `data/services.json` — the service list (manage from Admin → Services).
- `data/config.json` — admin password + session secret. Keep it secret.
- Backups: the server keeps a timestamped copy of a data file if it ever fails to parse.

With **`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set**, orders/items/services live in the `kv_store` table instead (local files are only used for the one-time migration on first connect). `data/config.json` stays local either way — set `ADMIN_PASSWORD` as an env var on the server so it doesn't reset on redeploys.

## API overview

Public (no login):
- `GET /api/search?q=username` — find orders by username
- `GET /api/customers/:id` — full order + progress (this is the customer tracking data)

Public (no login):
- `GET /api/items` — enabled items (gallery)
- `GET /api/services` — enabled services (rates table)

Admin (requires login cookie):
- `POST /api/login` `{password}` · `POST /api/logout` · `GET /api/admin/me`
- `GET /api/admin/customers` — summary list
- `POST /api/admin/customers` — create order
- `PUT /api/admin/customers/:id` — update order (including `progress` array)
- `DELETE /api/admin/customers/:id` — delete order
- `POST /api/admin/customers/:id/progress` — append a progress step
- `GET/POST /api/admin/items`, `PUT/DELETE /api/admin/items/:id` — item catalog
- `GET/POST /api/admin/services`, `PUT/DELETE /api/admin/services/:id`, `PUT /api/admin/services/order` — services

## Customizing

- **Your service prices**: edit `public/prices.html` (the "Our Service Rates" table).
- **Currency list / status names**: `server.js` (`CURRENCIES`, `CUSTOMER_STATUSES`, `PROGRESS_STATUSES`).
- **Look & feel**: `public/style.css`.

## Notes & legal

Selling Blox Fruits services/items for real money (and especially logging into customers' accounts) violates Roblox Terms of Service and risks account bans. Run this at your own risk and prefer carries done on the customer's own logged-in account. The price data in `PRICE_LIST.md` and `prices.html` is taken from the Blox Fruits Wiki and marketplaces and can change with game updates.
