const express = require('express');
const { query, tx, NOW } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { creditAd } = require('../wallet');

const router = express.Router();
const SHARE = Number(process.env.USER_REWARD_SHARE || 0.4);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.use(requireAuth, requireAdmin);

/* ---------------- Dashboard ---------------- */
router.get('/stats', wrap(async (_req, res) => {
  const [s] = await query(`
    SELECT
      (SELECT COUNT(*) FROM Users WHERE Role='user') AS Users,
      (SELECT COUNT(*) FROM Users WHERE Role='user' AND PlanId>1 AND PlanExpiresAt>${NOW}) AS PaidUsers,
      (SELECT COUNT(*) FROM Campaigns WHERE Status='active') AS ActiveCampaigns,
      (SELECT COUNT(*) FROM Submissions WHERE Status='pending') AS PendingSubmissions,
      (SELECT COUNT(*) FROM Withdrawals WHERE Status='pending') AS PendingWithdrawals,
      (SELECT COUNT(*) FROM PlanPurchases WHERE Status='pending') AS PendingPlans,
      (SELECT COUNT(*) FROM Campaigns WHERE ReviewStatus='pending') AS PendingReviews,
      (SELECT COUNT(*) FROM Deposits WHERE Status='pending') AS PendingDeposits,
      (SELECT IFNULL(SUM(Amount),0) FROM Deposits WHERE Status='approved') AS Deposited,
      (SELECT IFNULL(SUM(AdBalance),0) FROM Users) AS AdCredits,
      (SELECT IFNULL(SUM(c.AdvertiserRate),0) FROM Submissions s JOIN Campaigns c ON c.Id=s.CampaignId WHERE s.Status='approved') AS AdvertiserRevenue,
      (SELECT IFNULL(SUM(s.Reward),0) FROM Submissions s WHERE s.Status='approved') AS UserPayouts,
      (SELECT IFNULL(SUM(Amount),0) FROM PlanPurchases WHERE Status='approved') AS PlanRevenue,
      (SELECT IFNULL(SUM(Amount),0) FROM Withdrawals WHERE Status='paid') AS Withdrawn,
      (SELECT IFNULL(SUM(Balance),0) FROM Users) AS Liability`);
  res.json(s);
}));

/* ---------------- Submissions ---------------- */
router.get('/submissions', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json(await query(
    `SELECT s.*, u.Name AS UserName, u.Email AS UserEmail, c.Title, c.Platform, c.ActionType, c.TargetUrl
     FROM Submissions s JOIN Users u ON u.Id=s.UserId JOIN Campaigns c ON c.Id=s.CampaignId
     WHERE s.Status=@status ORDER BY s.CreatedAt ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`, { status }));
}));

router.post('/submissions/:id/approve', wrap(async (req, res) => {
  const ok = await tx(async (q) => {
    const [s] = await q(
      `UPDATE Submissions SET Status='approved', ReviewedBy=@admin, ReviewedAt=${NOW}
       WHERE Id=@id AND Status='pending'
       RETURNING UserId, CampaignId, Reward`, { id: Number(req.params.id), admin: req.user.id });
    if (!s) return false;
    await q('UPDATE Users SET Balance=ROUND(Balance+@r, 4), TotalEarned=ROUND(TotalEarned+@r, 4) WHERE Id=@uid', { r: s.Reward, uid: s.UserId });
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
  const ok = await tx(async (q) => {
    const [s] = await q(
      `UPDATE Submissions SET Status='rejected', RejectReason=@reason, ReviewedBy=@admin, ReviewedAt=${NOW}
       WHERE Id=@id AND Status='pending' RETURNING CampaignId`,
      { id: Number(req.params.id), admin: req.user.id, reason: req.body?.reason || 'Proof not valid' });
    if (!s) return false;
    // A user-posted task that was already stopped: give the freed slot back to its owner
    const [c] = await q('SELECT * FROM Campaigns WHERE Id=@id', { id: s.CampaignId });
    if (c.AdvertiserId && c.Status === 'completed' && c.CompletedCount < c.TargetCount) {
      await q('UPDATE Campaigns SET TargetCount=TargetCount-1 WHERE Id=@id', { id: c.Id });
      await creditAd(q, c.AdvertiserId, c.AdvertiserRate, 'campaign_refund', c.Id, `Refund for "${c.Title}" (rejected proof)`);
    }
    return true;
  });
  if (!ok) return res.status(409).json({ error: 'Already reviewed' });
  res.json({ ok: true });
}));

/* ---------------- Campaigns ---------------- */
router.get('/campaigns', wrap(async (req, res) => {
  const review = req.query.review === 'pending';
  res.json(await query(
    `SELECT c.*, u.Name AS OwnerName, u.Email AS OwnerEmail,
            (SELECT COUNT(*) FROM Submissions s WHERE s.CampaignId=c.Id AND s.Status='pending') AS PendingCount
     FROM Campaigns c LEFT JOIN Users u ON u.Id=c.AdvertiserId
     ${review ? "WHERE c.ReviewStatus='pending'" : ''}
     ORDER BY c.Id DESC`));
}));

/* User-posted tasks: approve to go live, or reject and refund the full budget as ad credits */
router.post('/campaigns/:id/approve', wrap(async (req, res) => {
  const rows = await query(
    `UPDATE Campaigns SET ReviewStatus='approved', Status='active'
     WHERE Id=@id AND ReviewStatus='pending' RETURNING Id`, { id: Number(req.params.id) });
  if (!rows.length) return res.status(409).json({ error: 'Already reviewed' });
  res.json({ ok: true });
}));

router.post('/campaigns/:id/reject', wrap(async (req, res) => {
  const ok = await tx(async (q) => {
    const [c] = await q(
      `UPDATE Campaigns SET ReviewStatus='rejected', Status='completed', RejectReason=@reason
       WHERE Id=@id AND ReviewStatus='pending' RETURNING *`,
      { id: Number(req.params.id), reason: req.body?.reason || 'Not allowed' });
    if (!c) return false;
    await creditAd(q, c.AdvertiserId, c.Budget, 'campaign_refund', c.Id, `Refund for "${c.Title}" (not approved)`);
    return true;
  });
  if (!ok) return res.status(409).json({ error: 'Already reviewed' });
  res.json({ ok: true });
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
     VALUES (@title, @desc, @platform, @action, @url, @thumb, @rate, @reward, @target) RETURNING *`,
    { title: b.title, desc: b.description || null, platform: b.platform, action: b.actionType, url: b.targetUrl,
      thumb: b.thumbnailUrl || null, rate, reward, target: Number(b.targetCount) });
  res.json(c);
}));

router.patch('/campaigns/:id/status', wrap(async (req, res) => {
  const status = req.body?.status;
  if (!['active', 'paused'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const rows = await query(
    `UPDATE Campaigns SET Status=@status WHERE Id=@id AND ReviewStatus='approved' AND Status<>'completed' RETURNING Id`,
    { id: Number(req.params.id), status });
  if (!rows.length) return res.status(400).json({ error: 'This campaign cannot be changed' });
  res.json({ ok: true });
}));

/* ---------------- Deposits (ad credits) ---------------- */
router.get('/deposits', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json(await query(
    `SELECT d.*, u.Name AS UserName, u.Email AS UserEmail FROM Deposits d JOIN Users u ON u.Id=d.UserId
     WHERE d.Status=@status ORDER BY d.Id DESC`, { status }));
}));

router.post('/deposits/:id/approve', wrap(async (req, res) => {
  const ok = await tx(async (q) => {
    const [d] = await q(
      `UPDATE Deposits SET Status='approved', ProcessedAt=${NOW}
       WHERE Id=@id AND Status='pending' RETURNING *`, { id: Number(req.params.id) });
    if (!d) return false;
    await creditAd(q, d.UserId, d.Amount, 'deposit', d.Id, `Added funds (UTR ${d.PaymentRef})`);
    return true;
  });
  if (!ok) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

router.post('/deposits/:id/reject', wrap(async (req, res) => {
  const rows = await query(
    `UPDATE Deposits SET Status='rejected', ProcessedAt=${NOW} WHERE Id=@id AND Status='pending' RETURNING Id`,
    { id: Number(req.params.id) });
  if (!rows.length) return res.status(409).json({ error: 'Already processed' });
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
    `UPDATE Withdrawals SET Status='paid', AdminNote=@note, ProcessedAt=${NOW}
     WHERE Id=@id AND Status='pending' RETURNING Id`, { id: Number(req.params.id), note: req.body?.note || null });
  if (!rows.length) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

router.post('/withdrawals/:id/reject', wrap(async (req, res) => {
  const ok = await tx(async (q) => {
    const [w] = await q(
      `UPDATE Withdrawals SET Status='rejected', AdminNote=@note, ProcessedAt=${NOW}
       WHERE Id=@id AND Status='pending' RETURNING UserId, Amount`,
      { id: Number(req.params.id), note: req.body?.note || 'Rejected' });
    if (!w) return false;
    await q('UPDATE Users SET Balance=ROUND(Balance+@a, 4) WHERE Id=@uid', { a: w.Amount, uid: w.UserId });
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
      `UPDATE PlanPurchases SET Status='approved', ProcessedAt=${NOW}
       WHERE Id=@id AND Status='pending' RETURNING UserId, PlanId`, { id: Number(req.params.id) });
    if (!pp) return false;
    await q(`UPDATE Users SET PlanId=@pid,
               PlanExpiresAt=strftime('%Y-%m-%dT%H:%M:%fZ','now', '+' || (SELECT DurationDays FROM Plans WHERE Id=@pid) || ' days')
             WHERE Id=@uid`, { pid: pp.PlanId, uid: pp.UserId });
    return true;
  });
  if (!ok) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

router.post('/purchases/:id/reject', wrap(async (req, res) => {
  const rows = await query(
    `UPDATE PlanPurchases SET Status='rejected', ProcessedAt=${NOW}
     WHERE Id=@id AND Status='pending' RETURNING Id`, { id: Number(req.params.id) });
  if (!rows.length) return res.status(409).json({ error: 'Already processed' });
  res.json({ ok: true });
}));

/* ---------------- Users ---------------- */
router.get('/users', wrap(async (req, res) => {
  const search = `%${req.query.q || ''}%`;
  res.json(await query(
    `SELECT u.Id, u.Name, u.Email, u.Phone, u.Role, u.Balance, u.TotalEarned, u.IsBlocked, u.CreatedAt,
            u.PlanExpiresAt, p.Name AS PlanName
     FROM Users u JOIN Plans p ON p.Id=u.PlanId
     WHERE u.Name LIKE @q OR u.Email LIKE @q ORDER BY u.CreatedAt DESC LIMIT 200`, { q: search }));
}));

router.post('/users/:id/block', wrap(async (req, res) => {
  await query("UPDATE Users SET IsBlocked=CASE WHEN IsBlocked=1 THEN 0 ELSE 1 END WHERE Id=@id AND Role<>'admin'",
    { id: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
