# NEXORA Backend (Express + SQLite)

Real API for auth, products, orders, coupons. Also serves the storefront.

## Start

```bash
cd server
npm install
npm start
```

Open: http://127.0.0.1:8787

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | demo@nexora.az | Demo1234 |
| Admin | admin@nexora.az | Admin1234 |

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Status |
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login → JWT |
| GET | `/api/auth/me` | Bearer | Current user |
| PUT | `/api/auth/me` | Bearer | Update profile |
| GET | `/api/products` | — | List (`q`, `category`, `limit`, `offset`, `sort`) |
| GET | `/api/products/:id` | — | Product detail |
| POST | `/api/products` | Admin | Create |
| PUT | `/api/products/:id` | Admin | Update |
| DELETE | `/api/products/:id` | Admin | Delete |
| GET | `/api/categories` | — | Categories |
| GET | `/api/coupons` | — | Coupons |
| GET | `/api/coupons/:code` | — | Validate coupon |
| POST | `/api/orders` | Bearer | Place order (stock decrements) |
| GET | `/api/orders/mine` | Bearer | My orders |
| GET | `/api/orders` | Admin | All orders |
| PATCH | `/api/orders/:id/status` | Admin | Update status |

## Reseed DB

```bash
npm run seed
```

DB file: `server/data/nexora.db`
