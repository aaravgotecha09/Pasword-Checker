const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/logic');
const { checkPassword } = require('../src/policy');

test('AND truth table has exactly one TRUE row (slide 7)', () => {
  const t = L.truthTable('p & q & r');
  assert.equal(t.rows.length, 8); assert.equal(t.trueCount, 1); assert.equal(t.classification, 'contingency');
});
test('implication is FALSE only for T -> F', () => {
  const t = L.truthTable('p -> q');
  assert.deepEqual(t.rows.map((r) => r.result), [true, true, false, true]);
});
test('A -> A style formula is a tautology (slide 9)', () => {
  assert.equal(L.truthTable('(p&q&r&s&t) -> (p&q&r&s&t)').classification, 'tautology');
});
test('De Morgan and contrapositive equivalences', () => {
  assert.ok(L.equivalent('!(p & q)', '!p | !q').equivalent);
  assert.ok(L.equivalent('p -> q', '!q -> !p').equivalent);
  assert.ok(!L.equivalent('p -> q', 'q -> p').equivalent);
});
test('parser rejects junk safely', () => {
  assert.throws(() => L.parse('process.exit()'));
  assert.throws(() => L.parse('p &'));
});
test('slide 12 test cases', () => {
  assert.equal(checkPassword('Study@2026').A, true);
  assert.equal(checkPassword('study@2026').A, false);
  assert.equal(checkPassword('Study2026').A, false);
  assert.deepEqual(checkPassword('abc').propositions.map((x) => x.value), [false, false, false, false, true]);
});

const C = require('../src/combinatorics');
test('inclusion-exclusion: 3-char strings with upper+digit+special = 3!*26*10*32', () => {
  assert.equal(C.countPolicy(3).satisfying, String(6 * 26 * 10 * 32));
});
test('fix() always yields a passing password', () => {
  for (const pw of ['abc', 'study@2026', 'password123', 'Study2026']) assert.ok(C.fix(pw).A, pw);
});
test('impossible level is provable and generate() passes policy', () => {
  assert.ok(C.puzzles().impossibleProved);
  assert.ok(checkPassword(C.generate().password).A);
});
