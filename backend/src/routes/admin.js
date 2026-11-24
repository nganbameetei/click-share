const express = require('express');
const { query, tx } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();
const SHARE = Number(process.env.USER_REWARD_SHARE || 0.4);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.use(requireAuth, requireAdmin);

/* ---------------- Dashboard ---------------- */
router.get('/stats', wrap(async (_req, res) => {
  const [s] = await query(`
    SELECT
      (SELECT COUNT(*) FROM Users WHERE Role='user') AS Users,
      (SELECT COUNT(*) FROM Users WHERE Role='user' AND PlanId>1 AND PlanExpiresAt>SYSUTCDATETIME()) AS PaidUsers,
      (SELECT COUNT(*) FROM Campaigns WHERE Status='active') AS ActiveCampaigns,
      (SELECT COUNT(*) FROM Submissions WHERE Status='pending') AS PendingSubmissions,
      (SELECT COUNT(*) FROM Withdrawals WHERE Status='pending') AS PendingWithdrawals,
      (SELECT COUNT(*) FROM PlanPurchases WHERE Status='pending') AS PendingPlans,
      (SELECT ISNULL(SUM(c.AdvertiserRate),0) FROM Submissions s JOIN Campaigns c ON c.Id=s.CampaignId WHERE s.Status='approved') AS AdvertiserRevenue,
      (SELECT ISNULL(SUM(s.Reward),0) FROM Submissions s WHERE s.Status='approved') AS UserPayouts,
      (SELECT ISNULL(SUM(Amount),0) FROM PlanPurchases WHERE Status='approved') AS PlanRevenue,
      (SELECT ISNULL(SUM(Amount),0) FROM Withdrawals WHERE Status='paid') AS Withdrawn,
      (SELECT ISNULL(SUM(Balance),0) FROM Users) AS Liability`);
  res.json(s);
}));

/* ---------------- Submissions ---------------- */
router.get('/submissions', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json(await query(
    `SELECT TOP 200 s.*, u.Name AS UserName, u.Email AS UserEmail, c.Title, c.Platform, c.ActionType, c.TargetUrl
     FROM Submissions s JOIN Users u ON u.Id=s.UserId JOIN Campaigns c ON c.Id=s.CampaignId
     WHERE s.Status=@status ORDER BY s.CreatedAt ${status === 'pending' ? 'ASC' : 'DESC'}`, { status }));
}));

router.post('/submissions/:id/approve', wrap(async (req, res) => {
  const ok = await tx(async (q) => {
    const [s] = await q(
      `UPDATE Submissions SET Status='approved', ReviewedBy=@admin, ReviewedAt=SYSUTCDATETIME()
       OUTPUT INSERTED.UserId, INSERTED.CampaignId, INSERTED.Reward
       WHERE Id=@id AND Status='pending'`, { id: Number(req.params.id), admin: req.user.id });
    if (!s) return false;
    await q('UPDATE Users SET Balance=Balance+@r, TotalEarned=TotalEarned+@r WHERE Id=@uid', { r: s.Reward, uid: s.UserId });
    await q(`INSERT INTO WalletTransactions (UserId, Amount, Type, Source, RefId, Note)
             VALUES (@uid, @r, 'credit', 'task', @ref, 'Task reward')`, { uid: s.UserId, r: s.Reward, ref: Number(req.params.id) });
    await q(`UPDATE Campaigns SET CompletedCount=CompletedCount+1,
               Status=CASE WHEN CompletedCount+1>=TargetCount THEN 'completed' ELSE Status END
             WHERE Id=@cid`, { cid: s.CampaignId });
    return true;
  });
  if (!ok) return res.status(409).json({ error: 'Already reviewed' });
  res.json({ ok: true });
}));

router.post('/submissions/:id/reject', wrap(async (req, res) => {
  const rows = await query(
    `UPDATE Submissions SET Status='rejected', RejectReason=@reason, ReviewedBy=@admin, ReviewedAt=SYSUTCDATETIME()
     OUTPUT INSERTED.Id WHERE Id=@id AND Status='pending'`,
    { id: Number(req.params.id), admin: req.user.id, reason: req.body?.reason || 'Proof not valid' });
  if (!rows.length) return res.status(409).json({ error: 'Already reviewed' });
  res.json({ ok: true });
}));

/* ---------------- Campaigns ---------------- */
router.get('/campaigns', wrap(async (_req, res) => {
  res.json(await query(
    `SELECT c.*, (SELECT COUNT(*) FROM Submissions s WHERE s.CampaignId=c.Id AND s.Status='pending') AS PendingCount
     FROM Campaigns c ORDER BY c.CreatedAt DESC`));
}));

router.post('/campaigns', wrap(async (req, res) => {
  const b = req.body || {};
  const rate = Number(b.advertiserRate);
  const reward = b.userReward ? Number(b.userReward) : Math.round(rate * SHARE * 10000) / 10000;
  if (!b.title || !b.targetUrl) return res.status(400).json({ error: 'Title and target URL are required' });
  if (!['facebook', 'instagram', 'youtube'].includes(b.platform)) return res.status(400).json({ error: 'Invalid platform' });
  if (!['share', 'like', 'follow'].includes(b.actionType)) return res.status(400).json({ error: 'Invalid action' });
  if (!(rate > 0) || !(reward > 0) || reward >= rate)
    return res.status(400).json({ error: 'User reward must be greater than 0 and less than the advertiser rate' });
  if (!(Number(b.targetCount) > 0)) return res.status(400).json({ error: 'Target count must be at least 1' });
  const [c] = await query(
    `INSERT INTO Campaigns (Title, Description, Platform, ActionType, TargetUrl, ThumbnailUrl, AdvertiserRate, UserReward, TargetCount)
     OUTPUT INSERTED.* VALUES (@title, @desc, @platform, @action, @url, @thumb, @rate, @reward, @target)`,
    { title: b.title, desc: b.description || null, platform: b.platform, action: b.actionType, url: b.targetUrl,
      thumb: b.thumbnailUrl || null, rate, reward, target: Number(b.targetCount) });
  res.json(c);
}));

router.patch('/campaigns/:id/status', wrap(async (req, res) => {
  const status = req.body?.status;
  if (!['active', 'paused', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await query('UPDATE Campaigns SET Status=@status WHERE Id=@id', { id: Number(req.params.id), status });
  res.json({ ok: true });
}));

/* ---------------- Withdrawals ---------------- */
router.get('/withdrawals', wrap(async (req, res) => {
  const status = ['pending', 'paid', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json(await query(
    `SELECT w.*, u.Name AS UserName, u.Email AS UserEmail FROM Withdrawals w JOIN Users u ON u.Id=w.UserId
     WHERE w.Status=@status ORDER BY w.CreatedAt DESC`, { status }));
}));

router.post('/withdrawals/:id/paid', wrap(async (req, res) => {
  const rows = await query(
    `UPDATE Withdrawals SET Status='paid', AdminNote=@note, ProcessedAt=SYSUTCDATETIME()
     OUTPUT INSERTED.Id WHERE Id=@id AND Status='pending'`, { id: Number(req.params.id), note: req.body?.note || null });
  if (!rows.length) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

router.post('/withdrawals/:id/reject', wrap(async (req, res) => {
  const ok = await tx(async (q) => {
    const [w] = await q(
      `UPDATE Withdrawals SET Status='rejected', AdminNote=@note, ProcessedAt=SYSUTCDATETIME()
       OUTPUT INSERTED.UserId, INSERTED.Amount WHERE Id=@id AND Status='pending'`,
      { id: Number(req.params.id), note: req.body?.note || 'Rejected' });
    if (!w) return false;
    await q('UPDATE Users SET Balance=Balance+@a WHERE Id=@uid', { a: w.Amount, uid: w.UserId });
    await q(`INSERT INTO WalletTransactions (UserId, Amount, Type, Source, RefId, Note)
             VALUES (@uid, @a, 'credit', 'refund', @ref, 'Withdrawal refunded')`, { uid: w.UserId, a: w.Amount, ref: Number(req.params.id) });
    return true;
  });
  if (!ok) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

/* ---------------- Plan purchases ---------------- */
router.get('/purchases', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json(await query(
    `SELECT pp.*, p.Name AS PlanName, u.Name AS UserName, u.Email AS UserEmail
     FROM PlanPurchases pp JOIN Plans p ON p.Id=pp.PlanId JOIN Users u ON u.Id=pp.UserId
     WHERE pp.Status=@status ORDER BY pp.CreatedAt DESC`, { status }));
}));

router.post('/purchases/:id/approve', wrap(async (req, res) => {
  const ok = await tx(async (q) => {
    const [pp] = await q(
      `UPDATE PlanPurchases SET Status='approved', ProcessedAt=SYSUTCDATETIME()
       OUTPUT INSERTED.UserId, INSERTED.PlanId WHERE Id=@id AND Status='pending'`, { id: Number(req.params.id) });
    if (!pp) return false;
    await q(`UPDATE u SET PlanId=p.Id, PlanExpiresAt=DATEADD(DAY, p.DurationDays, SYSUTCDATETIME())
             FROM Users u JOIN Plans p ON p.Id=@pid WHERE u.Id=@uid`, { pid: pp.PlanId, uid: pp.UserId });
    return true;
  });
  if (!ok) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

router.post('/purchases/:id/reject', wrap(async (req, res) => {
  const rows = await query(
    `UPDATE PlanPurchases SET Status='rejected', ProcessedAt=SYSUTCDATETIME() OUTPUT INSERTED.Id
     WHERE Id=@id AND Status='pending'`, { id: Number(req.params.id) });
  if (!rows.length) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

/* ---------------- Users ---------------- */
router.get('/users', wrap(async (req, res) => {
  const search = `%${req.query.q || ''}%`;
  res.json(await query(
    `SELECT TOP 200 u.Id, u.Name, u.Email, u.Phone, u.Role, u.Balance, u.TotalEarned, u.IsBlocked, u.CreatedAt,
            u.PlanExpiresAt, p.Name AS PlanName
     FROM Users u JOIN Plans p ON p.Id=u.PlanId
     WHERE u.Name LIKE @q OR u.Email LIKE @q ORDER BY u.CreatedAt DESC`, { q: search }));
}));

router.post('/users/:id/block', wrap(async (req, res) => {
  await query("UPDATE Users SET IsBlocked=CASE WHEN IsBlocked=1 THEN 0 ELSE 1 END WHERE Id=@id AND Role<>'admin'",
    { id: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
