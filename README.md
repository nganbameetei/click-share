# Click&Share

Users earn small rewards for liking, following and sharing advertiser posts on Facebook, Instagram and YouTube.

- **Backend:** Node.js + Express (`backend/`)
- **Database:** SQLite via libSQL: a local file in development, a free [Turso](https://turso.tech) database in production. The schema is in `database/schema.sql` and is applied automatically on start.
- **Frontend:** React + Vite + Tailwind CSS (`frontend/`)

## Business rules built in

| Rule | Where |
|---|---|
| Every task is an advertiser **campaign** with `AdvertiserRate` (what the brand pays) and `UserReward` (what the user gets). The DB rejects `UserReward >= AdvertiserRate`, so each action has a margin. | `Campaigns` table |
| The default user reward is 40% of the advertiser rate (`USER_REWARD_SHARE`). | `backend/.env` |
| Plans unlock **daily task slots** (Free 10, Basic ₹99 → 40, Standard ₹249 → 100, Pro ₹499 → 200). They never pay a fixed income. | `Plans` table |
| **Standard earns +15% and Pro +25%** on every task reward (`Plans.RewardBonusPct`). The bonus is capped at `MAX_REWARD_SHARE` (80%) of the advertiser rate, so you keep a margin even on Pro. | `rewardFor()` in `backend/src/routes/user.js` |
| A campaign stops showing once approved plus pending submissions reach its target, so users can't outnumber the paid budget. | `GET /api/tasks` |
| Rewards are credited only after an admin approves the screenshot proof. | Admin → Proofs |
| Minimum withdrawal is ₹100 (`MIN_WITHDRAWAL`). The balance is debited when the request is made and refunded if an admin rejects it. | Wallet |
| Plan payments are manual: the user pays to your UPI and enters the UTR, then an admin verifies it. | Plans / Admin → Plan requests |
| There is no referral income from joining fees, which keeps the app clear of money-circulation laws. | — |
| **Users can post their own tasks** (Promote page) at a fixed price per action (`PRICE_SHARE` ₹0.05, `PRICE_LIKE` ₹0.20, `PRICE_FOLLOW` ₹0.50). The cost is paid up front from ad credits first, then earnings. Doers get 40% (+ plan bonus) and the platform keeps the rest. | `backend/src/routes/promote.js` |
| User-posted tasks go live only after **admin review**. A rejected task, a stopped task's unused slots, and rejected proofs are refunded as ad credits. Users can't do their own tasks. | Admin → Campaigns |
| **Referrals (single level):** every user has a code (`/signup?ref=CODE`). The inviter earns `REFERRAL_TASK_PCT` (10%) of the friend's approved task rewards for `REFERRAL_TASK_DAYS` (90) days, paid by the platform on top (the friend keeps 100%). After `REFERRAL_MIN_TASKS` (10) approved tasks, the inviter gets `REFERRAL_INVITER_BONUS` (₹2) and the friend `REFERRAL_FRIEND_BONUS` (₹1). **Nothing is paid from plan fees or added funds.** That keeps it legal (no money circulation). | `backend/src/referral.js` |
| **Admin wallet changes:** Admin → Users → Credit adds or deducts money on Earnings (withdrawable) or Ad credits, with a required remark. Deductions can't go below ₹0. Every change is in the user's wallet history. | `POST /api/admin/users/:id/credit` |
| **Add funds:** users pay by UPI and enter the UTR, then an admin approves it as **ad credits**. Ad credits can only be spent on promotion and can't be withdrawn, so the app doesn't take withdrawable deposits. A UTR can't be used twice. | Admin → Add funds |

## Setup

1. Backend (creates `backend/data/clickshare.db` automatically):
   ```powershell
   cd backend; copy .env.example .env; npm install; npm run seed; npm start
   ```
2. Frontend (in a second terminal):
   ```powershell
   cd frontend; npm install; npm run dev
   ```
3. Open http://localhost:5173

## Deploy free: Render + Turso

1. **Turso:** sign up at https://turso.tech with GitHub. Create a database (e.g. `clickshare`) in the Mumbai or Singapore region. Copy its **URL** (`libsql://…turso.io`), then **Create Token** (read & write) and copy the token.
2. **Render:** New → Blueprint, then pick this repo. Fill in `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `PAYMENT_UPI_ID`, then click Deploy.
3. On first start the app creates the tables, the plans and the admin account in Turso.

On Render's free plan, uploaded proof screenshots are deleted on every restart or deploy (the Turso database is safe). For real users, add a disk (see `render.yaml`).

The seed creates local test accounts using the `ADMIN_*` and `DEMO_*` values in `backend/.env`. **Change them, and `JWT_SECRET`, before deploying.**

## API overview

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/signup`, `/api/auth/login` | public |
| GET | `/api/plans`, `/api/config` | public |
| GET/PUT | `/api/me` | user |
| GET | `/api/tasks?platform=` | user |
| POST | `/api/tasks/:id/submit` (multipart `proof`, `handle`) | user |
| GET | `/api/submissions` | user |
| GET | `/api/wallet` · POST `/api/wallet/withdraw` | user |
| POST | `/api/plans/:id/purchase` · GET `/api/plans/purchases` | user |
| GET | `/api/admin/stats` | admin |
| GET/POST | `/api/admin/submissions[/:id/approve|reject]` | admin |
| GET/POST/PATCH | `/api/admin/campaigns[/:id/status]` | admin |
| GET/POST | `/api/admin/withdrawals[/:id/paid|reject]` | admin |
| GET/POST | `/api/admin/purchases[/:id/approve|reject]` | admin |
| GET/POST | `/api/admin/users[/:id/block]` | admin |

## Next steps (not built yet)

- Advertiser self-serve portal with a prepaid wallet (campaigns are currently created by the admin)
- YouTube OAuth auto-verification of likes and subscriptions
- Razorpay/Cashfree for plan payments and automatic UPI payouts
- OTP phone verification and device/IP checks against multiple accounts
- TDS/KYC (PAN) collection above payout limits
