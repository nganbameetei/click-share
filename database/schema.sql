/* =========================================================
   Click&Share - MSSQL schema
   Run:  sqlcmd -S .\SQLEXPRESS -E -i database\schema.sql
   ========================================================= */
IF DB_ID('ClickShare') IS NULL CREATE DATABASE ClickShare;
GO
USE ClickShare;
GO

/* ---------- Plans ---------- */
IF OBJECT_ID('dbo.Plans') IS NULL
CREATE TABLE dbo.Plans (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    Name            NVARCHAR(50)  NOT NULL,
    Price           DECIMAL(10,2) NOT NULL DEFAULT 0,
    DailyTaskLimit  INT           NOT NULL,
    DurationDays    INT           NOT NULL DEFAULT 30,
    Badge           NVARCHAR(30)  NULL,
    IsActive        BIT           NOT NULL DEFAULT 1,
    SortOrder       INT           NOT NULL DEFAULT 0
);
GO

/* ---------- Users ---------- */
IF OBJECT_ID('dbo.Users') IS NULL
CREATE TABLE dbo.Users (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    Name          NVARCHAR(100) NOT NULL,
    Email         NVARCHAR(150) NOT NULL UNIQUE,
    Phone         NVARCHAR(15)  NULL,
    PasswordHash  NVARCHAR(200) NOT NULL,
    Role          NVARCHAR(20)  NOT NULL DEFAULT 'user'
                  CHECK (Role IN ('user','advertiser','admin')),
    PlanId        INT           NOT NULL DEFAULT 1 REFERENCES dbo.Plans(Id),
    PlanExpiresAt DATETIME2     NULL,
    Balance       DECIMAL(12,2) NOT NULL DEFAULT 0,
    TotalEarned   DECIMAL(12,2) NOT NULL DEFAULT 0,
    UpiId         NVARCHAR(100) NULL,
    IsBlocked     BIT           NOT NULL DEFAULT 0,
    CreatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* ---------- Campaigns (tasks funded by advertisers) ---------- */
IF OBJECT_ID('dbo.Campaigns') IS NULL
CREATE TABLE dbo.Campaigns (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    AdvertiserId    INT            NULL REFERENCES dbo.Users(Id),
    Title           NVARCHAR(150)  NOT NULL,
    Description     NVARCHAR(500)  NULL,
    Platform        NVARCHAR(20)   NOT NULL CHECK (Platform IN ('facebook','instagram','youtube')),
    ActionType      NVARCHAR(20)   NOT NULL CHECK (ActionType IN ('share','like','follow')),
    TargetUrl       NVARCHAR(500)  NOT NULL,
    ThumbnailUrl    NVARCHAR(500)  NULL,
    AdvertiserRate  DECIMAL(10,4)  NOT NULL,   -- what the advertiser pays per action
    UserReward      DECIMAL(10,4)  NOT NULL,   -- what the user earns per action
    TargetCount     INT            NOT NULL,
    CompletedCount  INT            NOT NULL DEFAULT 0,
    Status          NVARCHAR(20)   NOT NULL DEFAULT 'active'
                    CHECK (Status IN ('active','paused','completed')),
    CreatedAt       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Campaign_Margin CHECK (UserReward < AdvertiserRate)
);
GO

/* ---------- Submissions (proof that a user did a task) ---------- */
IF OBJECT_ID('dbo.Submissions') IS NULL
CREATE TABLE dbo.Submissions (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    CampaignId    INT            NOT NULL REFERENCES dbo.Campaigns(Id),
    UserId        INT            NOT NULL REFERENCES dbo.Users(Id),
    ProofImage    NVARCHAR(300)  NULL,
    ProofHandle   NVARCHAR(100)  NULL,   -- user's social username
    Reward        DECIMAL(10,4)  NOT NULL,
    Status        NVARCHAR(20)   NOT NULL DEFAULT 'pending'
                  CHECK (Status IN ('pending','approved','rejected')),
    RejectReason  NVARCHAR(200)  NULL,
    ReviewedBy    INT            NULL REFERENCES dbo.Users(Id),
    ReviewedAt    DATETIME2      NULL,
    CreatedAt     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Submission UNIQUE (CampaignId, UserId)
);
GO

/* ---------- Wallet ledger ---------- */
IF OBJECT_ID('dbo.WalletTransactions') IS NULL
CREATE TABLE dbo.WalletTransactions (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    UserId     INT            NOT NULL REFERENCES dbo.Users(Id),
    Amount     DECIMAL(12,2)  NOT NULL,
    Type       NVARCHAR(10)   NOT NULL CHECK (Type IN ('credit','debit')),
    Source     NVARCHAR(20)   NOT NULL,  -- task | withdrawal | refund
    RefId      INT            NULL,
    Note       NVARCHAR(200)  NULL,
    CreatedAt  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* ---------- Withdrawals ---------- */
IF OBJECT_ID('dbo.Withdrawals') IS NULL
CREATE TABLE dbo.Withdrawals (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    UserId       INT            NOT NULL REFERENCES dbo.Users(Id),
    Amount       DECIMAL(12,2)  NOT NULL,
    Fee          DECIMAL(12,2)  NOT NULL DEFAULT 0,
    UpiId        NVARCHAR(100)  NOT NULL,
    Status       NVARCHAR(20)   NOT NULL DEFAULT 'pending'
                 CHECK (Status IN ('pending','paid','rejected')),
    AdminNote    NVARCHAR(200)  NULL,
    CreatedAt    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    ProcessedAt  DATETIME2      NULL
);
GO

/* ---------- Plan purchase requests (manual UPI + UTR) ---------- */
IF OBJECT_ID('dbo.PlanPurchases') IS NULL
CREATE TABLE dbo.PlanPurchases (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    UserId      INT            NOT NULL REFERENCES dbo.Users(Id),
    PlanId      INT            NOT NULL REFERENCES dbo.Plans(Id),
    Amount      DECIMAL(10,2)  NOT NULL,
    PaymentRef  NVARCHAR(60)   NOT NULL,   -- UPI UTR number
    Status      NVARCHAR(20)   NOT NULL DEFAULT 'pending'
                CHECK (Status IN ('pending','approved','rejected')),
    CreatedAt   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    ProcessedAt DATETIME2      NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Submissions_User_Date')
    CREATE INDEX IX_Submissions_User_Date ON dbo.Submissions(UserId, CreatedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Submissions_Status')
    CREATE INDEX IX_Submissions_Status ON dbo.Submissions(Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Campaigns_Status')
    CREATE INDEX IX_Campaigns_Status ON dbo.Campaigns(Status, Platform);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Wallet_User')
    CREATE INDEX IX_Wallet_User ON dbo.WalletTransactions(UserId, CreatedAt DESC);
GO

/* ---------- Seed plans ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Plans)
BEGIN
    SET IDENTITY_INSERT dbo.Plans ON;
    INSERT INTO dbo.Plans (Id, Name, Price, DailyTaskLimit, DurationDays, Badge, SortOrder) VALUES
      (1, 'Free',      0,   10, 36500, NULL,           1),
      (2, 'Basic',    99,   40,    30, NULL,           2),
      (3, 'Standard', 249, 100,    30, 'Most Popular', 3),
      (4, 'Pro',      499, 200,    30, 'Best Value',   4);
    SET IDENTITY_INSERT dbo.Plans OFF;
END
GO

/* ---------- Plan reward bonus (% extra on every task reward) ---------- */
IF COL_LENGTH('dbo.Plans', 'RewardBonusPct') IS NULL
    ALTER TABLE dbo.Plans ADD RewardBonusPct INT NOT NULL CONSTRAINT DF_Plans_RewardBonus DEFAULT 0;
GO
UPDATE dbo.Plans SET RewardBonusPct = 15 WHERE Id = 3 AND RewardBonusPct = 0;  -- Standard
UPDATE dbo.Plans SET RewardBonusPct = 25 WHERE Id = 4 AND RewardBonusPct = 0;  -- Pro
GO
