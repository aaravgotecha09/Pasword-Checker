'use strict';
const express = require('express');
const cors = require('cors');
const logic = require('./src/logic');
const { checkPassword } = require('./src/policy');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render sits behind a proxy

const origins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cache-Control', 'no-store'); next(); });

// tiny in-memory rate limiter: 120 requests / minute / IP
const hits = new Map();
app.use((req, res, next) => {
  const now = Date.now(), e = hits.get(req.ip) || { n: 0, reset: now + 60000 };
  if (now > e.reset) { e.n = 0; e.reset = now + 60000; }
  e.n++; hits.set(req.ip, e);
  if (e.n > 120) return res.status(429).json({ error: 'Too many requests. Slow down.' });
  next();
});
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now > v.reset) hits.delete(k); }, 60000).unref();

const wrap = (fn) => (req, res) => { try { res.json(fn(req.body || {}, req.query)); } catch (e) { res.status(400).json({ error: e.message }); } };

app.get('/', (req, res) => res.json({ service: 'Password Policy Logic API', docs: '/api/health' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
// Passwords are processed in memory only: never logged, stored, or echoed back.
app.post('/api/check', wrap((b) => checkPassword(b.password, b.policy)));
app.post('/api/truth-table', wrap((b) => logic.truthTable(b.expression)));
app.post('/api/equivalence', wrap((b) => logic.equivalent(b.a, b.b)));
app.post('/api/evaluate', wrap((b) => logic.evalWith(b.expression, b.values || {})));
app.get('/api/test-cases', wrap(() => {
  const cases = [['Study@2026', 'All conditions TRUE'], ['study@2026', 'Only q FALSE'], ['Study2026', 'Only s FALSE'], ['abc', 'Multiple FALSE']];
  return cases.map(([pw, name]) => { const r = checkPassword(pw); return { sample: pw, name, values: r.propositions.map((x) => x.value), A: r.A, decision: r.decision }; });
}));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
const PORT = process.env.PORT || 3001;
if (require.main === module) app.listen(PORT, () => console.log(`API listening on :${PORT}`));
module.exports = app;
