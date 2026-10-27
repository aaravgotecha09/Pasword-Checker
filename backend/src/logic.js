'use strict';
// Safe propositional-logic engine: tokenizer -> recursive-descent parser -> evaluator. No eval().
// Precedence (high -> low): NOT, AND, OR, IMPLIES (right-assoc), IFF.
const MAX_VARS = 8;
const WORDS = { and: 'AND', or: 'OR', not: 'NOT', implies: 'IMP', iff: 'IFF', true: 'TRUE', false: 'FALSE' };

function tokenize(src) {
  if (typeof src !== 'string' || !src.trim()) throw new Error('Expression is empty.');
  if (src.length > 200) throw new Error('Expression too long (max 200 chars).');
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('<->', i) || src.startsWith('<=>', i)) { out.push({ t: 'IFF' }); i += 3; continue; }
    if (src.startsWith('->', i) || src.startsWith('=>', i)) { out.push({ t: 'IMP' }); i += 2; continue; }
    if (c === '↔') { out.push({ t: 'IFF' }); i++; continue; }
    if (c === '→') { out.push({ t: 'IMP' }); i++; continue; }
    if ('¬!~'.includes(c)) { out.push({ t: 'NOT' }); i++; continue; }
    if ('∧&'.includes(c)) { out.push({ t: 'AND' }); i++; continue; }
    if ('∨|'.includes(c)) { out.push({ t: 'OR' }); i++; continue; }
    if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
    if (c === '1' || c === '0') { out.push({ t: 'CONST', v: c === '1' }); i++; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j), k = WORDS[w.toLowerCase()];
      if (k === 'TRUE' || k === 'FALSE') out.push({ t: 'CONST', v: k === 'TRUE' });
      else if (k) out.push({ t: k });
      else out.push({ t: 'VAR', n: w });
      i = j; continue;
    }
    throw new Error(`Unexpected character "${c}".`);
  }
  return out;
}

function parse(src) {
  const toks = tokenize(src); let p = 0;
  const peek = () => toks[p] && toks[p].t;
  const eat = (t) => { if (peek() !== t) throw new Error(`Expected ${t === ')' ? 'closing bracket' : t}.`); return toks[p++]; };
  const iff = () => { let l = imp(); while (peek() === 'IFF') { p++; l = { k: 'bin', op: 'IFF', l, r: imp() }; } return l; };
  const imp = () => { const l = or(); if (peek() === 'IMP') { p++; return { k: 'bin', op: 'IMP', l, r: imp() }; } return l; };
  const or = () => { let l = and(); while (peek() === 'OR') { p++; l = { k: 'bin', op: 'OR', l, r: and() }; } return l; };
  const and = () => { let l = not(); while (peek() === 'AND') { p++; l = { k: 'bin', op: 'AND', l, r: not() }; } return l; };
  const not = () => { if (peek() === 'NOT') { p++; return { k: 'not', a: not() }; } return atom(); };
  const atom = () => {
    const t = toks[p];
    if (!t) throw new Error('Expression ended unexpectedly.');
    if (t.t === 'VAR') { p++; return { k: 'var', n: t.n }; }
    if (t.t === 'CONST') { p++; return { k: 'const', v: t.v }; }
    if (t.t === '(') { p++; const e = iff(); eat(')'); return e; }
    throw new Error('Unexpected symbol in expression.');
  };
  const ast = iff();
  if (p < toks.length) throw new Error('Unexpected trailing symbols.');
  return ast;
}

function variables(ast, acc = []) {
  if (ast.k === 'var') { if (!acc.includes(ast.n)) acc.push(ast.n); }
  else if (ast.k === 'not') variables(ast.a, acc);
  else if (ast.k === 'bin') { variables(ast.l, acc); variables(ast.r, acc); }
  return acc;
}

function evaluate(ast, env) {
  switch (ast.k) {
    case 'const': return ast.v;
    case 'var': if (!(ast.n in env)) throw new Error(`No value for ${ast.n}.`); return !!env[ast.n];
    case 'not': return !evaluate(ast.a, env);
    default: {
      const a = evaluate(ast.l, env), b = evaluate(ast.r, env);
      return ast.op === 'AND' ? a && b : ast.op === 'OR' ? a || b : ast.op === 'IMP' ? !a || b : a === b;
    }
  }
}

const SYM = { AND: '∧', OR: '∨', IMP: '→', IFF: '↔' };
const show = (n) => n.k === 'var' ? n.n : n.k === 'const' ? (n.v ? 'T' : 'F')
  : n.k === 'not' ? '¬' + show(n.a) : `(${show(n.l)} ${SYM[n.op]} ${show(n.r)})`;

function truthTable(src) {
  const ast = parse(src), vars = variables(ast);
  if (vars.length > MAX_VARS) throw new Error(`Max ${MAX_VARS} variables allowed.`);
  const rows = []; let trues = 0;
  for (let m = 0; m < 2 ** vars.length; m++) {   // F first, binary counting, first variable = MSB
    const values = vars.map((_, i) => !!((m >> (vars.length - 1 - i)) & 1));
    const env = Object.fromEntries(vars.map((v, i) => [v, values[i]]));
    const result = evaluate(ast, env); if (result) trues++;
    rows.push({ values, result });
  }
  const classification = trues === rows.length ? 'tautology' : trues === 0 ? 'contradiction' : 'contingency';
  return { expression: show(ast), variables: vars, rows, trueCount: trues, classification };
}

function equivalent(a, b) {
  const A = parse(a), B = parse(b);
  const vars = [...new Set([...variables(A), ...variables(B)])];
  if (vars.length > MAX_VARS) throw new Error(`Max ${MAX_VARS} variables allowed.`);
  for (let m = 0; m < 2 ** vars.length; m++) {
    const env = Object.fromEntries(vars.map((v, i) => [v, !!((m >> (vars.length - 1 - i)) & 1)]));
    const x = evaluate(A, env), y = evaluate(B, env);
    if (x !== y) return { equivalent: false, left: show(A), right: show(B), variables: vars, counterexample: env, leftValue: x, rightValue: y };
  }
  return { equivalent: true, left: show(A), right: show(B), variables: vars };
}

function evalWith(src, env) { const ast = parse(src); return { expression: show(ast), result: evaluate(ast, env) }; }

module.exports = { parse, evaluate, truthTable, equivalent, evalWith, show, variables };
