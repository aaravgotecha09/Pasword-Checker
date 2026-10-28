'use strict';
// Counting principle, inclusion-exclusion, entropy and puzzle helpers (Discrete Mathematics).
const crypto = require('crypto');
const { checkPassword, BLOCKLIST } = require('./policy');

const POOLS = [['lowercase', /[a-z]/, 26], ['uppercase', /[A-Z]/, 26], ['digits', /[0-9]/, 10], ['special', /[^A-Za-z0-9]/, 32]];
const UNITS = [['seconds', 1], ['minutes', 60], ['hours', 3600], ['days', 86400], ['years', 31557600]];

function human(log10s) { // input = log10(seconds)
  const yearsLog = log10s - Math.log10(31557600);
  if (yearsLog >= 6) return `about 10^${Math.round(yearsLog)} years`;
  const s = 10 ** log10s;
  if (s < 1) return 'instantly (under 1 second)';
  let best = UNITS[0];
  for (const u of UNITS) if (s >= u[1]) best = u;
  const v = s / best[1];
  return `${v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)} ${best[0]}`;
}

function strength(pw) {
  if (typeof pw !== 'string' || !pw || pw.length > 128) throw new Error('Enter a password up to 128 characters.');
  const used = POOLS.filter(([, re]) => re.test(pw));
  const charset = used.reduce((a, [, , n]) => a + n, 0);
  const listed = BLOCKLIST.has(pw.toLowerCase());
  const log10Space = pw.length * Math.log10(charset);
  const bits = listed ? 0 : pw.length * Math.log2(charset);
  const rates = [['Online attack, 100 guesses/s', 2], ['Offline, slow hash, 10^4/s', 4], ['Offline, GPU cluster, 10^13/s', 13]];
  const rating = bits < 28 ? 'Very weak' : bits < 36 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Excellent';
  return {
    length: pw.length, charset, pool: used.map(([n, , c]) => `${n} ${c}`).join(' + '), listed,
    bits: +bits.toFixed(1), log10Space: +log10Space.toFixed(1), rating,
    // average case: the attacker finds it after trying half the space
    crack: rates.map(([label, e]) => ({ label, time: listed ? 'instantly (it is on the common-password list)' : human(log10Space + Math.log10(0.5) - e) })),
  };
}

// Strings of length n over 94 printable symbols with >=1 uppercase, >=1 digit, >=1 special (q ∧ r ∧ s)
function countPolicy(n) {
  if (!Number.isInteger(n) || n < 1 || n > 64) throw new Error('Length must be an integer from 1 to 64.');
  const sizes = { U: 26, D: 10, S: 32 }, keys = ['U', 'D', 'S'], terms = [];
  let sat = 0n;
  for (let m = 0; m < 8; m++) {
    const ex = keys.filter((_, i) => (m >> i) & 1);
    const alphabet = 94 - ex.reduce((a, k) => a + sizes[k], 0);
    const count = BigInt(alphabet) ** BigInt(n), sign = ex.length % 2 ? -1n : 1n;
    sat += sign * count;
    terms.push({ excluded: ex.length ? 'no ' + ex.join(', no ') : 'nothing excluded', sign: sign > 0n ? '+' : '−', alphabet, count: count.toString() });
  }
  const total = 94n ** BigInt(n);
  return { length: n, total: total.toString(), satisfying: sat.toString(), percent: Number((sat * 100000n) / total) / 1000, lengthOK: n >= 8, terms };
}

const pick = (set) => set[crypto.randomInt(set.length)];
const LOW = 'abcdefghjkmnpqrstuvwxyz', UP = 'ABCDEFGHJKLMNPQRSTUVWXYZ', DIG = '23456789', SPC = '!@#$%^&*?';

function generate() {
  const chars = [pick(UP), pick(DIG), pick(SPC)];
  while (chars.length < 14) chars.push(pick(LOW + UP + DIG + SPC));
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return { password: chars.join('') };
}

function fix(pw, policy) {
  const r = checkPassword(pw, policy), need = (s) => r.failed.some((f) => f.symbol === s), changes = []; let out = pw;
  if (need('q')) { out += pick(UP); changes.push('added an uppercase letter (fixes q)'); }
  if (need('r')) { out += pick(DIG); changes.push('added a digit (fixes r)'); }
  if (need('s')) { out += pick(SPC); changes.push('added a special character (fixes s)'); }
  if (need('p') && out.length < r.policy.minLength) { while (out.length < r.policy.minLength) out += pick(LOW); changes.push('padded to the minimum length (fixes p)'); }
  if (r.policy.requireNotBlocked && BLOCKLIST.has(out.toLowerCase())) { out += pick(DIG); changes.push('appended a character so it is no longer on the list (fixes t)'); }
  return { fixed: out, changes, A: checkPassword(out, policy).A };
}

const LEVELS = [
  { id: 1, title: 'Perfect score', target: 'TTTTT', hint: 'Satisfy every rule.', why: 'A = T ∧ T ∧ T ∧ T ∧ T = T. This is the single TRUE row of the 32-row table.' },
  { id: 2, title: 'Forget the capital', target: 'TFTTT', hint: 'Long, with a digit and a symbol, but all lowercase.', why: 'Only q is false, so A = F. One false input is enough to make an AND false.' },
  { id: 3, title: 'No digits allowed', target: 'TTFTT', hint: 'Capital, symbol, 8+ chars, no numbers.', why: 'Only r is false, so A = F.' },
  { id: 4, title: 'Caught by the blocklist', target: 'TFTFF', hint: 'A very famous password with a number in it.', why: '"password123" is long and has digits, but it is on the prohibited list, so t = F.' },
  { id: 5, title: 'Everything fails', target: 'FFFFF', hint: 'A famous 6-letter keyboard walk.', why: 'Short, lowercase, no digit, no symbol, and on the list. A short blocklisted word like "qwerty" does it.' },
  { id: 6, title: 'The impossible one', target: 'TTTTF', impossible: true, hint: 'Long, capital, digit, symbol, yet on the blocklist?', why: 'Impossible. Every prohibited word contains only letters and digits, so t = F forces s = F. That is the implication (¬t → ¬s), so the row T,T,T,T,F can never occur.' },
];
const impossibleProof = () => [...BLOCKLIST].every((w) => !/[^A-Za-z0-9]/.test(w));
const puzzles = () => ({ levels: LEVELS, impossibleProved: impossibleProof() });

module.exports = { strength, countPolicy, generate, fix, puzzles };
