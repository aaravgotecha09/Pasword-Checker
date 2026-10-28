'use strict';
// Classroom demonstration policy from the slides: A = p ∧ q ∧ r ∧ s ∧ t
// NOTE: a teaching model only. NIST SP 800-63B-4 advises against composition rules.
const BLOCKLIST = new Set(['password', 'password1', 'password123', '123456', '12345678', '123456789', 'qwerty',
  'qwerty123', 'letmein', 'welcome', 'welcome1', 'admin', 'admin123', 'iloveyou', 'abc123', 'monkey', 'dragon',
  'football', 'baseball', 'sunshine', 'princess', 'login', 'passw0rd', 'master', 'hello123', '111111', '000000', 'india123']);

const LABELS = {
  p: 'Minimum length', q: 'Uppercase letter', r: 'Digit', s: 'Special character', t: 'Not on prohibited list',
};
const DEFAULT_POLICY = { minLength: 8, requireUpper: true, requireDigit: true, requireSpecial: true, requireNotBlocked: true };

function sanitizePolicy(raw = {}) {
  const n = Number(raw.minLength);
  return {
    minLength: Number.isInteger(n) && n >= 1 && n <= 64 ? n : DEFAULT_POLICY.minLength,
    requireUpper: raw.requireUpper !== false, requireDigit: raw.requireDigit !== false,
    requireSpecial: raw.requireSpecial !== false, requireNotBlocked: raw.requireNotBlocked !== false,
  };
}

function checkPassword(pw, rawPolicy) {
  if (typeof pw !== 'string' || pw.length > 128) throw new Error('Password must be a string up to 128 characters.');
  const policy = sanitizePolicy(rawPolicy);
  const values = {
    p: pw.length >= policy.minLength, q: /[A-Z]/.test(pw), r: /[0-9]/.test(pw),
    s: /[^A-Za-z0-9]/.test(pw), t: !BLOCKLIST.has(pw.toLowerCase()),
  };
  const active = { p: true, q: policy.requireUpper, r: policy.requireDigit, s: policy.requireSpecial, t: policy.requireNotBlocked };
  const used = Object.keys(values).filter((k) => active[k]);
  const A = used.every((k) => values[k]);
  const T = (b) => (b ? 'T' : 'F');
  return {
    propositions: Object.keys(values).map((k) => ({ symbol: k, label: LABELS[k], value: values[k], active: active[k] })),
    expression: 'A = ' + (used.join(' ∧ ') || 'T'),
    substituted: 'A = ' + (used.map((k) => T(values[k])).join(' ∧ ') || 'T'),
    A,
    decision: A ? 'PASS' : 'FAIL',
    failed: used.filter((k) => !values[k]).map((k) => ({ symbol: k, label: LABELS[k] })), // by label, never the password itself
    policy,
  };
}

module.exports = { checkPassword, LABELS, DEFAULT_POLICY, BLOCKLIST };
