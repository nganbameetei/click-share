# Click&Share

Users earn small rewards for liking, following and sharing advertiser posts on Facebook, Instagram and YouTube.

- **Backend:** Node.js + Express + MSSQL (`backend/`)
- **Frontend:** React + Vite + Tailwind CSS (`frontend/`)
- **Database:** `database/schema.sql`

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

## Setup

1. Create the database (Windows auth, SQL Server Express):
   ```powershell
   sqlcmd -S .\SQLEXPRESS -E -i database\schema.sql
   ```
2. Backend:
   ```powershell
   cd backend; copy .env.example .env; npm install; npm run seed; npm start
   ```
   For SQL authentication instead of Windows authentication, set `DB_TRUSTED=false` and fill in `DB_USER`, `DB_PASSWORD` and `DB_PORT` (TCP/IP must be enabled on the instance).
3. Frontend (in a second terminal):
   ```powershell
   cd frontend; npm install; npm run dev
   ```
4. Open http://localhost:5173

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
