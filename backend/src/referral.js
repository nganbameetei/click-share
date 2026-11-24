/*
 * Referral rewards - single level, paid by the platform out of its own margin.
 * Nothing is ever paid from a friend's plan fee or added funds (that would be a
 * money-circulation scheme). Rewards depend only on the friend doing real tasks.
 */
const crypto = require('crypto');
const { round } = require('./wallet');

const REFERRAL = {
  // % of each approved task reward the friend earns, paid extra to the inviter (friend loses nothing)
  taskPct: Number(process.env.REFERRAL_TASK_PCT ?? 10),
  // how long the inviter keeps earning that % (days from the friend's signup)
  taskDays: Number(process.env.REFERRAL_TASK_DAYS ?? 90),
  // one-time bonuses, paid once the friend has this many approved tasks (stops fake accounts)
  minTasks: Number(process.env.REFERRAL_MIN_TASKS ?? 10),
  inviterBonus: Number(process.env.REFERRAL_INVITER_BONUS ?? 2),
  friendBonus: Number(process.env.REFERRAL_FRIEND_BONUS ?? 1),
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function newReferralCode() {
  const bytes = crypto.randomBytes(6);
  return 'CS' + [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

async function credit(q, userId, amount, source, refId, note) {
  if (!(amount > 0)) return;
  await q('UPDATE Users SET Balance=ROUND(Balance+@a, 4) WHERE Id=@uid', { a: amount, uid: userId });
  await q(`INSERT INTO WalletTransactions (UserId, Amount, Type, Source, RefId, Note)
           VALUES (@uid, @a, 'credit', @src, @ref, @note)`, { uid: userId, a: round(amount, 4), src: source, ref: refId, note });
}

/** Call inside the transaction that approves a task submission. */
async function onTaskApproved(q, userId, reward, submissionId) {
  const [u] = await q(
    `SELECT u.Id, u.Name, u.ReferredBy, u.ReferralBonusPaid, u.CreatedAt, r.IsBlocked AS InviterBlocked,
            (SELECT COUNT(*) FROM Submissions s WHERE s.UserId=u.Id AND s.Status='approved') AS Approved
     FROM Users u LEFT JOIN Users r ON r.Id=u.ReferredBy WHERE u.Id=@uid`, { uid: userId });
  if (!u || !u.ReferredBy || u.InviterBlocked) return;
  const firstName = (u.Name || 'friend').split(' ')[0];

  // Ongoing % of the friend's task rewards, for a limited time
  const ageDays = (Date.now() - Date.parse(u.CreatedAt)) / 86400000;
  if (REFERRAL.taskPct > 0 && ageDays <= REFERRAL.taskDays) {
    await credit(q, u.ReferredBy, round(reward * REFERRAL.taskPct / 100), 'referral', submissionId,
      `${REFERRAL.taskPct}% of ${firstName}'s task reward`);
  }

  // One-time joining bonus for both, after the friend proves to be real
  if (!u.ReferralBonusPaid && u.Approved >= REFERRAL.minTasks) {
    const [flag] = await q('UPDATE Users SET ReferralBonusPaid=1 WHERE Id=@uid AND ReferralBonusPaid=0 RETURNING Id', { uid: u.Id });
    if (flag) {
      await credit(q, u.ReferredBy, REFERRAL.inviterBonus, 'referral_bonus', u.Id, `Bonus: ${firstName} completed ${REFERRAL.minTasks} tasks`);
      await credit(q, u.Id, REFERRAL.friendBonus, 'referral_bonus', u.Id, `Welcome bonus for joining with a referral`);
    }
  }
}

module.exports = { REFERRAL, newReferralCode, onTaskApproved };
