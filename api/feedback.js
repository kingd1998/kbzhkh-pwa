// Vercel serverless function: принимает текст доработки из PWA и создаёт issue
// в GitHub-репозитории приложения. Токен — только в переменных окружения Vercel
// (GITHUB_TOKEN), в клиентский код никогда не попадает.

const OWNER = 'kingd1998';
const REPO = 'kbzhkh-pwa';
const MAX_LENGTH = 4000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > MAX_LENGTH) {
    res.status(400).json({ error: 'invalid text' });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'server not configured' });
    return;
  }

  const firstLine = text.split('\n')[0].trim();
  const title = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
  const body = `${text}\n\n---\nОтправлено из PWA, ${new Date().toISOString()}`;

  const ghRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kbzhkh-pwa-feedback',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, body })
  });

  if (!ghRes.ok) {
    res.status(502).json({ error: 'github error' });
    return;
  }

  res.status(200).json({ ok: true });
};
