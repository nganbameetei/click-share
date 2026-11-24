/* Creates the admin + demo accounts and sample campaigns (local development only). */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, getPool } = require('../src/db');

async function upsertUser(name, email, password, role) {
  const [u] = await query('SELECT Id FROM Users WHERE Email=@email', { email });
  if (u) return u.Id;
  const hash = await bcrypt.hash(password, 10);
  const [n] = await query(
    'INSERT INTO Users (Name, Email, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@name, @email, @hash, @role)',
    { name, email, hash, role });
  return n.Id;
}

const samples = [
  ['Like our new Diwali reel', 'instagram', 'like', 0.20, 0.08, 500],
  ['Follow @StyleStreet India', 'instagram', 'follow', 0.50, 0.20, 300],
  ['Share the Monsoon Sale post', 'facebook', 'share', 0.05, 0.02, 1000],
  ['Like the TechGuru page', 'facebook', 'like', 0.20, 0.08, 400],
  ['Subscribe to CookWithRiya', 'youtube', 'follow', 0.60, 0.25, 250],
  ['Like the "Top 10 Phones" video', 'youtube', 'like', 0.20, 0.08, 600],
];

(async () => {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    await upsertUser('Admin', process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, 'admin');
  // Demo user + sample campaigns only when SEED_DEMO=true (local development)
  const demo = process.env.SEED_DEMO === 'true';
  if (demo && process.env.DEMO_EMAIL) await upsertUser('Demo User', process.env.DEMO_EMAIL, process.env.DEMO_PASSWORD, 'user');
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM Campaigns');
  if (demo && n === 0) {
    for (const [title, platform, action, rate, reward, target] of samples) {
      const url = platform === 'youtube' ? 'https://www.youtube.com/' : platform === 'facebook' ? 'https://www.facebook.com/' : 'https://www.instagram.com/';
      await query(
        `INSERT INTO Campaigns (Title, Platform, ActionType, TargetUrl, AdvertiserRate, UserReward, TargetCount)
         VALUES (@title, @platform, @action, @url, @rate, @reward, @target)`,
        { title, platform, action, url, rate, reward, target });
    }
  }
  console.log('Seed complete.');
  (await getPool()).close();
})().catch((e) => { console.error(e); process.exit(1); });
