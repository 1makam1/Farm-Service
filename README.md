# BloxFarm Tracker

A small web app for a Blox Fruits farming service:

- **Customers** can search by Roblox username and **view** their order progress (read-only).
- **Admin** logs in with a password and can **add / edit / delete** orders and progress steps.
- A **Prices** page shows all Blox Fruits item prices and your service rates (edit the tables in `public/prices.html`).

Zero dependencies — just Node.js. Data is stored in a JSON file (`data/accounts.json`).

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
4. **Important — data persistence:** Render's filesystem is wiped on every deploy, which would reset your orders, items, and admin password. To keep data:
   - **Free tier:** data resets whenever the service restarts/redeploys — fine for testing only.
   - **Paid (Starter+):** attach a **Persistent Disk** (e.g. 1 GB mounted at `/var/data`) and set `DATA_DIR=/var/data` so orders/items survive redeploys.
5. The app listens on the `PORT` Render provides automatically.

## Ports / hosting

- Change port: `PORT=8080 node server.js` (default 3000).
- To allow other people to reach it, run with `HOST=0.0.0.0` and open the port in your firewall / router:

```bash
HOST=0.0.0.0 node server.js
```

For a public site, deploy the folder to any Node host (Render, Railway, Fly.io, a VPS, etc.) — the app has no dependencies, so `npm install` isn't needed. Set `ADMIN_PASSWORD` there and note that data is stored locally on that server (add a volume/disk for the `data/` folder).

## Data

- `data/accounts.json` — your orders. Edit it only while the server is stopped.
- `data/items.json` — the item catalog (manage from Admin → Items).
- `data/services.json` — the service list (manage from Admin → Services).
- `data/config.json` — admin password + session secret. Keep it secret.
- Backups: the server keeps a timestamped copy of a data file if it ever fails to parse.

## API overview

Public (no login):
- `GET /api/search?q=username` — find orders by username
- `GET /api/customers/:id` — full order + progress (this is the customer tracking data)

Admin (requires login cookie):
- `POST /api/login` `{password}` · `POST /api/logout` · `GET /api/admin/me`
- `GET /api/admin/customers` — summary list
- `POST /api/admin/customers` — create order
- `PUT /api/admin/customers/:id` — update order (including `progress` array)
- `DELETE /api/admin/customers/:id` — delete order
- `POST /api/admin/customers/:id/progress` — append a progress step

## Customizing

- **Your service prices**: edit `public/prices.html` (the "Our Service Rates" table).
- **Currency list / status names**: `server.js` (`CURRENCIES`, `CUSTOMER_STATUSES`, `PROGRESS_STATUSES`).
- **Look & feel**: `public/style.css`.

## Notes & legal

Selling Blox Fruits services/items for real money (and especially logging into customers' accounts) violates Roblox Terms of Service and risks account bans. Run this at your own risk and prefer carries done on the customer's own logged-in account. The price data in `PRICE_LIST.md` and `prices.html` is taken from the Blox Fruits Wiki and marketplaces and can change with game updates.
