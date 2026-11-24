-- =========================================================
-- Click&Share - SQLite / libSQL (Turso) schema
-- Applied automatically on server start (safe to re-run).
-- Timestamps are ISO-8601 UTC strings, e.g. 2026-11-24T06:13:19.550Z
-- =========================================================

CREATE TABLE IF NOT EXISTS Plans (
  Id              INTEGER PRIMARY KEY,
  Name            TEXT    NOT NULL,
  Price           REAL    NOT NULL DEFAULT 0,
  DailyTaskLimit  INTEGER NOT NULL,
  DurationDays    INTEGER NOT NULL DEFAULT 30,
  Badge           TEXT,
  IsActive        INTEGER NOT NULL DEFAULT 1,
  SortOrder       INTEGER NOT NULL DEFAULT 0,
  RewardBonusPct  INTEGER NOT NULL DEFAULT 0   -- % extra on every task reward
);

CREATE TABLE IF NOT EXISTS Users (
  Id            INTEGER PRIMARY KEY AUTOINCREMENT,
  Name          TEXT    NOT NULL,
  Email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  Phone         TEXT,
  PasswordHash  TEXT    NOT NULL,
  Role          TEXT    NOT NULL DEFAULT 'user' CHECK (Role IN ('user','advertiser','admin')),
  PlanId        INTEGER NOT NULL DEFAULT 1 REFERENCES Plans(Id),
  PlanExpiresAt TEXT,
  Balance       REAL    NOT NULL DEFAULT 0,
  TotalEarned   REAL    NOT NULL DEFAULT 0,
  AdBalance     REAL    NOT NULL DEFAULT 0,   -- money added to promote own posts (not withdrawable)
  ReferralCode  TEXT,                         -- this user's invite code (unique index below)
  ReferredBy    INTEGER REFERENCES Users(Id), -- who invited this user
  ReferralBonusPaid INTEGER NOT NULL DEFAULT 0, -- joining bonus already paid for this user
  UpiId         TEXT,
  IsBlocked     INTEGER NOT NULL DEFAULT 0,
  CreatedAt     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Tasks funded by advertisers
CREATE TABLE IF NOT EXISTS Campaigns (
  Id              INTEGER PRIMARY KEY AUTOINCREMENT,
  AdvertiserId    INTEGER REFERENCES Users(Id),
  Title           TEXT    NOT NULL,
  Description     TEXT,
  Platform        TEXT    NOT NULL CHECK (Platform IN ('facebook','instagram','youtube')),
  ActionType      TEXT    NOT NULL CHECK (ActionType IN ('share','like','follow')),
  TargetUrl       TEXT    NOT NULL,
  ThumbnailUrl    TEXT,
  AdvertiserRate  REAL    NOT NULL,   -- what the advertiser pays per action
  UserReward      REAL    NOT NULL,   -- base amount the user earns per action
  TargetCount     INTEGER NOT NULL,
  CompletedCount  INTEGER NOT NULL DEFAULT 0,
  Status          TEXT    NOT NULL DEFAULT 'active' CHECK (Status IN ('active','paused','completed')),
  ReviewStatus    TEXT    NOT NULL DEFAULT 'approved',   -- pending | approved | rejected (user-posted tasks)
  Budget          REAL    NOT NULL DEFAULT 0,            -- amount the poster paid up front
  RejectReason    TEXT,
  CreatedAt       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (UserReward < AdvertiserRate)
);

-- Money users add (UPI + UTR) to promote their own posts. Credited to AdBalance after admin check.
CREATE TABLE IF NOT EXISTS Deposits (
  Id          INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId      INTEGER NOT NULL REFERENCES Users(Id),
  Amount      REAL    NOT NULL,
  PaymentRef  TEXT    NOT NULL,
  Status      TEXT    NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending','approved','rejected')),
  CreatedAt   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ProcessedAt TEXT
);

-- Proof that a user did a task
CREATE TABLE IF NOT EXISTS Submissions (
  Id            INTEGER PRIMARY KEY AUTOINCREMENT,
  CampaignId    INTEGER NOT NULL REFERENCES Campaigns(Id),
  UserId        INTEGER NOT NULL REFERENCES Users(Id),
  ProofImage    TEXT,
  ProofHandle   TEXT,
  Reward        REAL    NOT NULL,
  Status        TEXT    NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending','approved','rejected')),
  RejectReason  TEXT,
  ReviewedBy    INTEGER REFERENCES Users(Id),
  ReviewedAt    TEXT,
  CreatedAt     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (CampaignId, UserId)
);

CREATE TABLE IF NOT EXISTS WalletTransactions (
  Id         INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId     INTEGER NOT NULL REFERENCES Users(Id),
  Amount     REAL    NOT NULL,
  Type       TEXT    NOT NULL CHECK (Type IN ('credit','debit')),
  Source     TEXT    NOT NULL,          -- task | withdrawal | refund
  RefId      INTEGER,
  Note       TEXT,
  CreatedAt  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS Withdrawals (
  Id           INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId       INTEGER NOT NULL REFERENCES Users(Id),
  Amount       REAL    NOT NULL,
  Fee          REAL    NOT NULL DEFAULT 0,
  UpiId        TEXT    NOT NULL,
  Status       TEXT    NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending','paid','rejected')),
  AdminNote    TEXT,
  CreatedAt    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ProcessedAt  TEXT
);

-- Plan purchase requests (manual UPI + UTR)
CREATE TABLE IF NOT EXISTS PlanPurchases (
  Id          INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId      INTEGER NOT NULL REFERENCES Users(Id),
  PlanId      INTEGER NOT NULL REFERENCES Plans(Id),
  Amount      REAL    NOT NULL,
  PaymentRef  TEXT    NOT NULL,          -- UPI UTR number, or 'ADMIN' when set by an admin
  Status      TEXT    NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending','approved','rejected')),
  Remark      TEXT,                      -- admin's comment (e.g. "Paid cash", "Free promo")
  GrantedBy   INTEGER REFERENCES Users(Id),
  ExpiresAt   TEXT,                      -- plan end date this record gave the user
  CreatedAt   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ProcessedAt TEXT
);

CREATE INDEX IF NOT EXISTS IX_Submissions_User_Date ON Submissions(UserId, CreatedAt);
CREATE INDEX IF NOT EXISTS IX_Submissions_Status    ON Submissions(Status);
CREATE INDEX IF NOT EXISTS IX_Campaigns_Status      ON Campaigns(Status, Platform);
CREATE INDEX IF NOT EXISTS IX_Wallet_User           ON WalletTransactions(UserId, CreatedAt);
CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_RefCode  ON Users(ReferralCode);
CREATE INDEX IF NOT EXISTS IX_Users_ReferredBy      ON Users(ReferredBy);

INSERT OR IGNORE INTO Plans (Id, Name, Price, DailyTaskLimit, DurationDays, Badge, SortOrder, RewardBonusPct) VALUES
  (1, 'Free',       0,  10, 36500, NULL,           1,  0),
  (2, 'Basic',     99,  40,    30, NULL,           2,  0),
  (3, 'Standard', 249, 100,    30, 'Most Popular', 3, 15),
  (4, 'Pro',      499, 200,    30, 'Best Value',   4, 25);
