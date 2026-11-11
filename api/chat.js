// Función serverless (Vercel, Node 18+). La API key vive SOLO en variables de entorno.
const SYSTEM = require('./_system.js');

const hits = new Map(); // límite por IP (mejor esfuerzo: en serverless la memoria no se comparte entre instancias)
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = Number(process.env.RATE_MAX || 20);
  const a = (hits.get(ip) || []).filter(t => now - t < win);
  a.push(now); hits.set(ip, a);
  if (hits.size > 5000) hits.clear();
  return a.length > max;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const allow = process.env.ALLOWED_ORIGIN; // opcional: https://tu-dominio.vercel.app
  if (allow) {
    const o = req.headers.origin;
    if (o && o !== allow) return res.status(403).json({ error: 'origin' });
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '?';
  if (limited(ip)) return res.status(429).json({ error: 'rate' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'json' }); } }
  const msgs = body && Array.isArray(body.messages) ? body.messages : null;
  if (!msgs) return res.status(400).json({ error: 'messages' });
  const clean = msgs.slice(-6)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 500) }));
  if (!clean.length || clean[clean.length - 1].role !== 'user') return res.status(400).json({ error: 'messages' });

  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'system', content: SYSTEM }, ...clean],
        max_tokens: 450, temperature: 0.3, stream: false
      }),
      signal: ctl.signal
    });
    if (!r.ok) return res.status(502).json({ error: 'upstream', status: r.status });
    const j = await r.json();
    const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) return res.status(502).json({ error: 'empty' });
    return res.status(200).json({ reply: String(text).slice(0, 2000) });
  } catch (e) {
    return res.status(502).json({ error: e && e.name === 'AbortError' ? 'timeout' : 'network' });
  } finally {
    clearTimeout(timer);
  }
};
