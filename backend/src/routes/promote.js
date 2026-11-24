/* Users posting their own tasks ("Promote") for other users to do. */
const express = require('express');
const { query, tx } = require('../db');
const { requireAuth } = require('../auth');
const { creditAd, round, PRICES } = require('../wallet');

const router = express.Router();
const SHARE = Number(process.env.USER_REWARD_SHARE || 0.4);
const MIN_TARGET = Number(process.env.MIN_TASK_TARGET || 10);
const MAX_TARGET = 10000;
const MIN_DEPOSIT = Number(process.env.MIN_DEPOSIT || 50);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const PLATFORM_HOSTS = {
  facebook: /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i,
  instagram: /(^|\.)instagram\.com$/i,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/i,
};

router.use(requireAuth);

router.get('/pricing', (_req, res) => res.json({
  prices: PRICES, minTarget: MIN_TARGET, maxTarget: MAX_TARGET, minDeposit: MIN_DEPOSIT,
  paymentUpiId: process.env.PAYMENT_UPI_ID || null,
}));

router.get('/campaigns', wrap(async (req, res) => {
  res.json(await query(
    `SELECT c.Id, c.Title, c.Description, c.Platform, c.ActionType, c.TargetUrl, c.AdvertiserRate AS Price,
            c.TargetCount, c.CompletedCount, c.Status, c.ReviewStatus, c.Budget, c.RejectReason, c.CreatedAt,
            (SELECT COUNT(*) FROM Submissions s WHERE s.CampaignId=c.Id AND s.Status='pending') AS PendingCount
     FROM Campaigns c WHERE c.AdvertiserId=@uid ORDER BY c.Id DESC`, { uid: req.user.id }));
}));

router.post('/campaigns', wrap(async (req, res) => {
  const b = req.body || {};
  const title = (b.title || '').trim();
  const count = Math.floor(Number(b.targetCount));
  if (title.length < 3 || title.length > 120) return res.status(400).json({ error: 'Give your task a title (3–120 characters)' });
  if (!PLATFORM_HOSTS[b.platform]) return res.status(400).json({ error: 'Choose Facebook, Instagram or YouTube' });
  if (!PRICES[b.actionType]) return res.status(400).json({ error: 'Choose share, like or follow' });
  let url;
  try { url = new URL(b.targetUrl); } catch { return res.status(400).json({ error: 'Enter the full link to your post or profile' }); }
  if (!/^https?:$/.test(url.protocol) || !PLATFORM_HOSTS[b.platform].test(url.hostname))
    return res.status(400).json({ error: `The link must be a ${{ facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube' }[b.platform]} link` });
  if (!(count >= MIN_TARGET && count <= MAX_TARGET))
    return res.status(400).json({ error: `Number of people must be between ${MIN_TARGET} and ${MAX_TARGET}` });

  const rate = PRICES[b.actionType];
  const reward = round(rate * SHARE);
  const cost = round(rate * count, 2);

  const created = await tx(async (q) => {
    const [u] = await q('SELECT Balance, AdBalance FROM Users WHERE Id=@uid', { uid: req.user.id });
    if (u.AdBalance + u.Balance < cost - 1e-9) return null;
    const fromAd = round(Math.min(u.AdBalance, cost));
    const fromEarn = round(cost - fromAd);
    await q('UPDATE Users SET AdBalance=ROUND(AdBalance-@a, 4), Balance=ROUND(Balance-@e, 4) WHERE Id=@uid',
      { a: fromAd, e: fromEarn, uid: req.user.id });
    const [c] = await q(
      `INSERT INTO Campaigns (AdvertiserId, Title, Description, Platform, ActionType, TargetUrl, AdvertiserRate, UserReward,
                              TargetCount, Status, ReviewStatus, Budget)
       VALUES (@uid, @title, @desc, @platform, @action, @url, @rate, @reward, @count, 'paused', 'pending', @cost) RETURNING Id`,
      { uid: req.user.id, title, desc: (b.description || '').trim().slice(0, 300) || null, platform: b.platform,
        action: b.actionType, url: url.toString(), rate, reward, count, cost });
    const parts = [fromAd > 0 && `₹${fromAd.toFixed(2)} ad credits`, fromEarn > 0 && `₹${fromEarn.toFixed(2)} earnings`].filter(Boolean).join(' + ');
    await q(`INSERT INTO WalletTransactions (UserId, Amount, Type, Source, RefId, Note)
             VALUES (@uid, @cost, 'debit', 'campaign', @ref, @note)`,
      { uid: req.user.id, cost, ref: c.Id, note: `Promote "${title}" (${parts})` });
    return c;
  });
  if (!created) return res.status(400).json({ error: `Not enough balance. This task costs ₹${cost.toFixed(2)}. Add funds first.` });
  res.json({ ok: true, id: created.Id, cost });
}));

async function ownCampaign(id, uid) {
  const [c] = await query('SELECT * FROM Campaigns WHERE Id=@id AND AdvertiserId=@uid', { id: Number(id), uid });
  return c;
}

router.post('/campaigns/:id/pause', wrap(async (req, res) => {
  const c = await ownCampaign(req.params.id, req.user.id);
  if (!c || c.ReviewStatus !== 'approved' || c.Status !== 'active') return res.status(400).json({ error: 'This task cannot be paused' });
  await query("UPDATE Campaigns SET Status='paused' WHERE Id=@id", { id: c.Id });
  res.json({ ok: true });
}));

router.post('/campaigns/:id/resume', wrap(async (req, res) => {
  const c = await ownCampaign(req.params.id, req.user.id);
  if (!c || c.ReviewStatus !== 'approved' || c.Status !== 'paused') return res.status(400).json({ error: 'This task cannot be resumed' });
  await query("UPDATE Campaigns SET Status='active' WHERE Id=@id", { id: c.Id });
  res.json({ ok: true });
}));

/** Stop a task and refund the unused slots to ad credits. */
router.post('/campaigns/:id/cancel', wrap(async (req, res) => {
  const refund = await tx(async (q) => {
    const [c] = await q('SELECT * FROM Campaigns WHERE Id=@id AND AdvertiserId=@uid', { id: Number(req.params.id), uid: req.user.id });
    if (!c || c.Status === 'completed' || c.ReviewStatus === 'rejected') return null;
    const [{ pending }] = await q("SELECT COUNT(*) AS pending FROM Submissions WHERE CampaignId=@id AND Status='pending'", { id: c.Id });
    const open = Math.max(0, c.TargetCount - c.CompletedCount - pending);
    const amount = c.ReviewStatus === 'pending' ? c.Budget : round(open * c.AdvertiserRate, 2);
    await q(`UPDATE Campaigns SET Status='completed', TargetCount=@keep, RejectReason='Cancelled by you',
               ReviewStatus=CASE WHEN ReviewStatus='pending' THEN 'rejected' ELSE ReviewStatus END
             WHERE Id=@id`, { id: c.Id, keep: c.ReviewStatus === 'pending' ? c.TargetCount : c.CompletedCount + pending });
    await creditAd(q, req.user.id, amount, 'campaign_refund', c.Id, `Refund for "${c.Title}"`);
    return amount;
  });
  if (refund === null) return res.status(400).json({ error: 'This task is already finished' });
  res.json({ ok: true, refund });
}));

/* ---------------- Add funds (UPI + UTR, checked by admin) ---------------- */
router.get('/deposits', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM Deposits WHERE UserId=@uid ORDER BY Id DESC LIMIT 50', { uid: req.user.id }));
}));

router.post('/deposits', wrap(async (req, res) => {
  const amount = Math.floor(Number(req.body?.amount));
  const ref = (req.body?.paymentRef || '').trim();
  if (!(amount >= MIN_DEPOSIT && amount <= 100000)) return res.status(400).json({ error: `Amount must be between ₹${MIN_DEPOSIT} and ₹1,00,000` });
  if (!/^\w{6,30}$/.test(ref)) return res.status(400).json({ error: 'Enter the UPI transaction / UTR number' });
  const [used] = await query(
    `SELECT 1 AS x FROM Deposits WHERE PaymentRef=@ref AND Status<>'rejected'
     UNION SELECT 1 FROM PlanPurchases WHERE PaymentRef=@ref AND Status<>'rejected'`, { ref });
  if (used) return res.status(409).json({ error: 'This UTR number was already used' });
  await query('INSERT INTO Deposits (UserId, Amount, PaymentRef) VALUES (@uid, @amount, @ref)', { uid: req.user.id, amount, ref });
  res.json({ ok: true });
}));

module.exports = router;
