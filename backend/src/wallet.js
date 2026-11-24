/** Shared wallet helpers. `q` is a query function (inside a transaction). */

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/** Credit ad credits (not withdrawable) + ledger row. */
async function creditAd(q, userId, amount, source, refId, note) {
  if (!(amount > 0)) return;
  await q('UPDATE Users SET AdBalance=ROUND(AdBalance+@a, 4) WHERE Id=@uid', { a: amount, uid: userId });
  await q(`INSERT INTO WalletTransactions (UserId, Amount, Type, Source, RefId, Note)
           VALUES (@uid, @a, 'credit', @src, @ref, @note)`, { uid: userId, a: round(amount, 2), src: source, ref: refId, note });
}

// What a user pays per action when promoting their own post (platform price list)
const PRICES = {
  share: Number(process.env.PRICE_SHARE || 0.05),
  like: Number(process.env.PRICE_LIKE || 0.2),
  follow: Number(process.env.PRICE_FOLLOW || 0.5),
};

module.exports = { creditAd, round, PRICES };
