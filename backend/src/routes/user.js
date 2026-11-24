const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { query, tx } = require('../db');
const { sign, requireAuth } = require('../auth');

const router = express.Router();
const MIN_WITHDRAWAL = Number(process.env.MIN_WITHDRAWAL || 100);
const WITHDRAWAL_FEE = Number(process.env.WITHDRAWAL_FEE || 0);
// Plan bonuses never push a user's reward above this share of the advertiser rate
const MAX_REWARD_SHARE = Number(process.env.MAX_REWARD_SHARE || 0.8);

/** Base reward + plan bonus, capped so the platform always keeps a margin. */
function rewardFor(base, advertiserRate, bonusPct) {
  const boosted = base * (1 + (bonusPct || 0) / 100);
  const cap = advertiserRate * MAX_REWARD_SHARE;
  const r = boosted <= cap ? boosted : Math.max(base, cap);
  return Math.round(r * 10000) / 10000;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'uploads'),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype)),
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* Effective plan: falls back to Free (Id 1) when a paid plan has expired */
const PLAN_SQL = `
  SELECT u.Id, u.Name, u.Email, u.Phone, u.Role, u.Balance, u.TotalEarned, u.UpiId, u.CreatedAt,
         u.PlanExpiresAt,
         p.Id AS PlanId, p.Name AS PlanName, p.DailyTaskLimit, p.RewardBonusPct
  FROM Users u
  JOIN Plans p ON p.Id = CASE WHEN u.PlanExpiresAt IS NULL OR u.PlanExpiresAt > SYSUTCDATETIME()
                              THEN u.PlanId ELSE 1 END
  WHERE u.Id = @id`;

async function loadMe(id) {
  const [me] = await query(PLAN_SQL, { id });
  const [stats] = await query(
    `SELECT
       (SELECT COUNT(*) FROM Submissions WHERE UserId=@id
          AND CreatedAt >= CAST(CAST(SYSUTCDATETIME() AS DATE) AS DATETIME2)) AS TodayCount,
       (SELECT ISNULL(SUM(Reward),0) FROM Submissions WHERE UserId=@id AND Status='pending') AS PendingEarning,
       (SELECT COUNT(*) FROM Submissions WHERE UserId=@id AND Status='approved') AS ApprovedCount`,
    { id }
  );
  return { ...me, ...stats };
}

/* ---------------- Auth ---------------- */
router.post('/auth/signup', wrap(async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const [exists] = await query('SELECT Id FROM Users WHERE Email=@email', { email: email.toLowerCase() });
  if (exists) return res.status(409).json({ error: 'This email is already registered' });
  const hash = await bcrypt.hash(password, 10);
  const [user] = await query(
    `INSERT INTO Users (Name, Email, Phone, PasswordHash) OUTPUT INSERTED.Id, INSERTED.Role
     VALUES (@name, @email, @phone, @hash)`,
    { name: name.trim(), email: email.toLowerCase().trim(), phone: phone || null, hash }
  );
  res.json({ token: sign(user), user: await loadMe(user.Id) });
}));

router.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const [user] = await query('SELECT Id, Role, PasswordHash, IsBlocked FROM Users WHERE Email=@email', {
    email: (email || '').toLowerCase().trim(),
  });
  if (!user || !(await bcrypt.compare(password || '', user.PasswordHash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  if (user.IsBlocked) return res.status(403).json({ error: 'Your account is blocked' });
  res.json({ token: sign(user), user: await loadMe(user.Id) });
}));

/* ---------------- Public ---------------- */
router.get('/config', (_req, res) =>
  res.json({ minWithdrawal: MIN_WITHDRAWAL, withdrawalFee: WITHDRAWAL_FEE, paymentUpiId: process.env.PAYMENT_UPI_ID })
);

router.get('/plans', wrap(async (_req, res) => {
  res.json(await query('SELECT * FROM Plans WHERE IsActive=1 ORDER BY SortOrder'));
}));

/* ---------------- Logged-in user ---------------- */
router.use(requireAuth);

router.get('/me', wrap(async (req, res) => res.json(await loadMe(req.user.id))));

router.put('/me', wrap(async (req, res) => {
  const { name, phone, upiId } = req.body || {};
  await query('UPDATE Users SET Name=ISNULL(@name,Name), Phone=@phone, UpiId=@upiId WHERE Id=@id', {
    id: req.user.id, name: name || null, phone: phone || null, upiId: upiId || null,
  });
  res.json(await loadMe(req.user.id));
}));

router.get('/tasks', wrap(async (req, res) => {
  const platform = ['facebook', 'instagram', 'youtube'].includes(req.query.platform) ? req.query.platform : null;
  const [plan] = await query(PLAN_SQL, { id: req.user.id });
  const rows = await query(
    `SELECT c.Id, c.Title, c.Description, c.Platform, c.ActionType, c.TargetUrl, c.ThumbnailUrl,
            c.UserReward, c.AdvertiserRate, c.TargetCount,
            (SELECT COUNT(*) FROM Submissions s WHERE s.CampaignId=c.Id AND s.Status<>'rejected') AS Taken
     FROM Campaigns c
     WHERE c.Status='active'
       AND (@platform IS NULL OR c.Platform=@platform)
       AND NOT EXISTS (SELECT 1 FROM Submissions s WHERE s.CampaignId=c.Id AND s.UserId=@uid)
       AND (SELECT COUNT(*) FROM Submissions s WHERE s.CampaignId=c.Id AND s.Status<>'rejected') < c.TargetCount
     ORDER BY c.UserReward DESC, c.CreatedAt DESC`,
    { uid: req.user.id, platform }
  );
  // Never expose the advertiser rate to users
  res.json(rows.map(({ AdvertiserRate, UserReward, ...t }) => ({
    ...t,
    BaseReward: UserReward,
    Reward: rewardFor(UserReward, AdvertiserRate, plan.RewardBonusPct),
    BonusPct: plan.RewardBonusPct,
  })));
}));

router.post('/tasks/:id/submit', upload.single('proof'), wrap(async (req, res) => {
  const me = await loadMe(req.user.id);
  if (me.TodayCount >= me.DailyTaskLimit)
    return res.status(429).json({ error: `Daily limit reached (${me.DailyTaskLimit} tasks). Upgrade your plan for more.` });
  if (!req.file) return res.status(400).json({ error: 'Please upload a screenshot as proof' });

  const [c] = await query(
    `SELECT Id, UserReward, AdvertiserRate, TargetCount, Status,
       (SELECT COUNT(*) FROM Submissions s WHERE s.CampaignId=c.Id AND s.Status<>'rejected') AS Taken
     FROM Campaigns c WHERE Id=@id`,
    { id: Number(req.params.id) }
  );
  if (!c || c.Status !== 'active' || c.Taken >= c.TargetCount)
    return res.status(410).json({ error: 'This task is no longer available' });

  try {
    await query(
      `INSERT INTO Submissions (CampaignId, UserId, ProofImage, ProofHandle, Reward)
       VALUES (@cid, @uid, @img, @handle, @reward)`,
      { cid: c.Id, uid: req.user.id, img: `/uploads/${req.file.filename}`, handle: req.body.handle || null, reward: rewardFor(c.UserReward, c.AdvertiserRate, me.RewardBonusPct) }
    );
  } catch (e) {
    if (/UQ_Submission/.test(e.message)) return res.status(409).json({ error: 'You already did this task' });
    throw e;
  }
  res.json({ ok: true, me: await loadMe(req.user.id) });
}));

router.get('/submissions', wrap(async (req, res) => {
  res.json(await query(
    `SELECT TOP 200 s.Id, s.Status, s.Reward, s.RejectReason, s.CreatedAt, c.Title, c.Platform, c.ActionType
     FROM Submissions s JOIN Campaigns c ON c.Id=s.CampaignId
     WHERE s.UserId=@uid ORDER BY s.CreatedAt DESC`,
    { uid: req.user.id }
  ));
}));

/* ---------------- Wallet ---------------- */
router.get('/wallet', wrap(async (req, res) => {
  const [transactions, withdrawals] = await Promise.all([
    query('SELECT TOP 100 * FROM WalletTransactions WHERE UserId=@uid ORDER BY CreatedAt DESC', { uid: req.user.id }),
    query('SELECT TOP 50 * FROM Withdrawals WHERE UserId=@uid ORDER BY CreatedAt DESC', { uid: req.user.id }),
  ]);
  res.json({ me: await loadMe(req.user.id), transactions, withdrawals });
}));

router.post('/wallet/withdraw', wrap(async (req, res) => {
  const amount = Math.floor(Number(req.body?.amount) * 100) / 100;
  const upiId = (req.body?.upiId || '').trim();
  if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) return res.status(400).json({ error: 'Enter a valid UPI ID (e.g. name@okaxis)' });
  if (!(amount >= MIN_WITHDRAWAL)) return res.status(400).json({ error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL}` });

  const result = await tx(async (q) => {
    const [u] = await q('UPDATE Users SET Balance=Balance-@amt, UpiId=@upi OUTPUT INSERTED.Balance WHERE Id=@uid AND Balance>=@amt',
      { uid: req.user.id, amt: amount, upi: upiId });
    if (!u) return null;
    const [w] = await q(`INSERT INTO Withdrawals (UserId, Amount, Fee, UpiId) OUTPUT INSERTED.Id
                         VALUES (@uid, @amt, @fee, @upi)`, { uid: req.user.id, amt: amount, fee: WITHDRAWAL_FEE, upi: upiId });
    await q(`INSERT INTO WalletTransactions (UserId, Amount, Type, Source, RefId, Note)
             VALUES (@uid, @amt, 'debit', 'withdrawal', @ref, @note)`,
      { uid: req.user.id, amt: amount, ref: w.Id, note: `Withdrawal to ${upiId}` });
    return w;
  });
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json({ ok: true });
}));

/* ---------------- Plans ---------------- */
router.post('/plans/:id/purchase', wrap(async (req, res) => {
  const paymentRef = (req.body?.paymentRef || '').trim();
  if (!/^\w{6,30}$/.test(paymentRef)) return res.status(400).json({ error: 'Enter the UPI transaction / UTR number' });
  const [plan] = await query('SELECT * FROM Plans WHERE Id=@id AND IsActive=1 AND Price>0', { id: Number(req.params.id) });
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const [pending] = await query("SELECT Id FROM PlanPurchases WHERE UserId=@uid AND Status='pending'", { uid: req.user.id });
  if (pending) return res.status(409).json({ error: 'You already have a plan request under review' });
  await query('INSERT INTO PlanPurchases (UserId, PlanId, Amount, PaymentRef) VALUES (@uid, @pid, @amt, @ref)',
    { uid: req.user.id, pid: plan.Id, amt: plan.Price, ref: paymentRef });
  res.json({ ok: true });
}));

router.get('/plans/purchases', wrap(async (req, res) => {
  res.json(await query(
    `SELECT pp.*, p.Name AS PlanName FROM PlanPurchases pp JOIN Plans p ON p.Id=pp.PlanId
     WHERE pp.UserId=@uid ORDER BY pp.CreatedAt DESC`, { uid: req.user.id }));
}));

module.exports = router;
