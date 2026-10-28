import './style.css';
import { api } from './api.js';
import { circuit, deMorgan, strengthBox, puzzle, mathLab } from './extras.js';

const $ = (s, r = document) => r.querySelector(s);
const tf = (b) => (b ? 'T' : 'F');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

$('#app').innerHTML = `
<header><small>DISCRETE MATHEMATICS × CYBERSECURITY</small>
<h1>LogicLock · Password Policy Simulator</h1>
<p>Logic circuits · truth tables · counting principle · inclusion–exclusion (Unit 2, CO2)</p></header>
<div id="status">Connecting to logic server…</div>
<nav id="tabs"></nav><main id="view"></main>`;

const tabs = { validator: 'Circuit Validator', puzzle: 'Break the Gate', math: 'Counting Lab', table: 'Truth Table Lab', ops: 'Operators', tests: 'Test Cases' };
let current = 'validator', ft = null;

// ---- server status (Render free tier sleeps; first call can take ~50 s) ----
async function ping() {
  const el = $('#status'); el.textContent = 'Waking up the logic server (free hosting can take up to a minute)…';
  for (let i = 0; i < 12; i++) {
    try { await api('/api/health'); el.innerHTML = '<b>● Server online</b>'; return; }
    catch { await new Promise((r) => setTimeout(r, 5000)); }
  }
  el.innerHTML = '<i>● Server unreachable. Check VITE_API_URL / backend deployment.</i>';
}

function renderTable(t, hl = -1) {
  return `<div class="tablewrap"><table><thead><tr>${t.variables.map((v) => `<th>${esc(v)}</th>`).join('')}<th>${esc(t.expression)}</th></tr></thead><tbody>
  ${t.rows.map((r, i) => `<tr class="${i === hl ? 'hl' : ''}">${r.values.map((v) => `<td class="${tf(v)}">${tf(v)}</td>`).join('')}<td class="${tf(r.result)}"><b>${tf(r.result)}</b></td></tr>`).join('')}
  </tbody></table></div>`;
}

// ---------------- Validator ----------------
function validator(v) {
  v.innerHTML = `
  <div class="card"><h2>Test a password against A = p ∧ q ∧ r ∧ s ∧ t</h2>
  <p class="mut">Checked in memory on the server, never stored or logged. Use sample passwords, not real ones.</p>
  <div class="row"><input id="pw" type="password" placeholder="Type a test password…" maxlength="128" autocomplete="off" />
  <button class="g" id="eye">Show</button></div>
  <div><label class="chk">Min length <input id="len" type="number" min="1" max="64" value="8" style="width:70px;padding:6px"></label>
  <label class="chk"><input type="checkbox" id="u" checked> uppercase (q)</label><label class="chk"><input type="checkbox" id="d" checked> digit (r)</label>
  <label class="chk"><input type="checkbox" id="s" checked> special (s)</label><label class="chk"><input type="checkbox" id="b" checked> not prohibited (t)</label></div>
  <div class="row" style="margin-top:8px"><span class="mut">Try:</span>${['Study@2026', 'study2026', 'Study2026', 'abc', 'password123'].map((x) => `<button class="g ex">${x}</button>`).join('')}</div></div>
  <div class="card" id="out"><span class="mut">Type a password to see each proposition evaluated.</span></div>
  <div class="card"><h2>Where this input sits in the 32-row truth table</h2><div id="tt" class="mut">Loading…</div></div>`;
  const pw = $('#pw');
  const run = async () => {
    const out = $('#out');
    try {
      const policy = { minLength: +$('#len').value, requireUpper: $('#u').checked, requireDigit: $('#d').checked, requireSpecial: $('#s').checked, requireNotBlocked: $('#b').checked };
      const r = await api('/api/check', { password: pw.value, policy });
      out.innerHTML = circuit(r) + `<div class="chips">${r.propositions.map((p) => `<div class="chip ${p.active ? tf(p.value) : 'off'}"><div class="s">${p.symbol}</div><div class="v">${tf(p.value)}</div><small>${p.label}${p.active ? '' : ' (off)'}</small></div>`).join('')}</div>
      <div class="eq">${r.expression}</div><div class="eq">${r.substituted} = ${tf(r.A)}</div>
      <div class="verdict ${r.decision}">${r.A ? 'A = TRUE · PASSES the illustrative policy' : 'A = FALSE · FAILS at least one requirement'}</div>
      ${r.failed.length ? `<p class="mut">Failed: ${r.failed.map((f) => `${f.symbol} (${f.label})`).join(', ')}</p>` : ''}
      <div class="mut" style="margin-top:8px">${deMorgan(r)}</div><div id="sx" style="margin-top:12px"></div><div class="warn">Teaching model only. NIST SP 800-63B-4 advises against forced composition rules; length and blocklists matter more.</div>`;
      strengthBox($('#sx'), pw.value, r, (np) => { pw.value = np; run(); });
      if (ft) {
        const idx = r.propositions.reduce((m, p) => (m << 1) | (p.value ? 1 : 0), 0);
        $('#tt').innerHTML = renderTable(ft, idx);
        const row = $('#tt tr.hl'); if (row) row.scrollIntoView({ block: 'nearest' });
      }
    } catch (e) { out.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  const d = debounce(run, 250);
  v.querySelectorAll('input').forEach((i) => i.addEventListener('input', d));
  $('#eye').onclick = () => { const h = pw.type === 'password'; pw.type = h ? 'text' : 'password'; $('#eye').textContent = h ? 'Hide' : 'Show'; };
  v.querySelectorAll('.ex').forEach((b) => (b.onclick = () => { pw.value = b.textContent; run(); }));
  api('/api/truth-table', { expression: 'p & q & r & s & t' }).then((t) => { ft = t; $('#tt').innerHTML = renderTable(t); run(); }).catch((e) => ($('#tt').textContent = e.message));
}

// ---------------- Truth Table Lab ----------------
function lab(v) {
  const ex = ['p & q & r', 'p -> q', '!(p & q) <-> (!p | !q)', '(p&q&r&s&t) -> (p&q&r&s&t)', 'p | !p', 'p & !p'];
  v.innerHTML = `<div class="card"><h2>Truth table &amp; tautology checker</h2>
  <p class="mut">Operators: ! ¬ NOT · &amp; ∧ AND · | ∨ OR · -&gt; → IMPLIES · &lt;-&gt; ↔ IFF. Max 8 variables.</p>
  <div class="row"><input id="ex" type="text" value="p & q & r" spellcheck="false"><button class="b" id="go">Build table</button></div>
  <div class="row" style="margin-top:8px">${ex.map((e) => `<button class="g e">${esc(e)}</button>`).join('')}</div><div id="res"></div></div>
  <div class="card"><h2>Logical equivalence</h2><p class="mut">Are two expressions equal for every assignment? (De Morgan, contrapositive…)</p>
  <div class="row"><input id="a" type="text" value="p -> q"><input id="b2" type="text" value="!q -> !p"><button class="b" id="eqb">Compare</button></div><div id="eqr"></div></div>`;
  const go = async () => {
    try { const t = await api('/api/truth-table', { expression: $('#ex').value });
      $('#res').innerHTML = `<div class="badge ${t.classification}">${t.classification.toUpperCase()} · ${t.trueCount}/${t.rows.length} rows TRUE</div>${renderTable(t)}`;
    } catch (e) { $('#res').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  $('#go').onclick = go; $('#ex').onkeydown = (e) => e.key === 'Enter' && go();
  v.querySelectorAll('.e').forEach((b) => (b.onclick = () => { $('#ex').value = b.textContent; go(); }));
  $('#eqb').onclick = async () => {
    try { const r = await api('/api/equivalence', { a: $('#a').value, b: $('#b2').value });
      $('#eqr').innerHTML = r.equivalent ? `<div class="badge tautology">EQUIVALENT</div><p>${esc(r.left)} ≡ ${esc(r.right)}</p>`
        : `<div class="badge contradiction">NOT EQUIVALENT</div><p>Counterexample: ${Object.entries(r.counterexample).map(([k, x]) => `${k}=${tf(x)}`).join(', ')} gives ${tf(r.leftValue)} vs ${tf(r.rightValue)}.</p>`;
    } catch (e) { $('#eqr').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  go();
}

// ---------------- Operators ----------------
function ops(v) {
  const st = { p: true, q: false };
  v.innerHTML = `<div class="card"><h2>Operator playground</h2><p class="mut">Flip p and q, watch every connective update.</p>
  <div class="row"><button class="tog" data-k="p"></button><button class="tog" data-k="q"></button></div><div class="ops" id="o" style="margin-top:14px"></div></div>`;
  const draw = async () => {
    v.querySelectorAll('.tog').forEach((b) => { b.className = `tog ${tf(st[b.dataset.k])}`; b.textContent = `${b.dataset.k} = ${tf(st[b.dataset.k])}`; });
    const list = ['!p', 'p & q', 'p | q', 'p -> q', 'p <-> q'];
    const rs = await Promise.all(list.map((e) => api('/api/evaluate', { expression: e, values: st })));
    $('#o').innerHTML = rs.map((r) => `<div class="chip ${tf(r.result)}"><div class="s">${esc(r.expression.replace(/^\((.*)\)$/, '$1'))}</div><div class="v">${tf(r.result)}</div></div>`).join('');
  };
  v.querySelectorAll('.tog').forEach((b) => (b.onclick = () => { st[b.dataset.k] = !st[b.dataset.k]; draw(); }));
  draw().catch(() => {});
}

// ---------------- Test cases ----------------
async function tests(v) {
  v.innerHTML = '<div class="card"><h2>Slide 12 test cases, now actually executed</h2><div id="t" class="mut">Running…</div></div>';
  try {
    const r = await api('/api/test-cases');
    $('#t').innerHTML = `<div class="tablewrap"><table><thead><tr><th>Case</th><th>Input</th><th>p</th><th>q</th><th>r</th><th>s</th><th>t</th><th>A</th><th>Decision</th></tr></thead><tbody>
    ${r.map((c, i) => `<tr><td style="text-align:left">${i + 1} · ${c.name}</td><td>${esc(c.sample)}</td>${c.values.map((x) => `<td class="${tf(x)}">${tf(x)}</td>`).join('')}<td class="${tf(c.A)}"><b>${tf(c.A)}</b></td><td class="${tf(c.A)}"><b>${c.decision}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="mut">These are real outputs from the backend validator. Compare with the expected outcomes on slide 12.</p>`;
  } catch (e) { $('#t').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

const views = { validator, puzzle, math: mathLab, table: lab, ops, tests };
function show(k) {
  current = k;
  $('#tabs').innerHTML = Object.entries(tabs).map(([id, n]) => `<button class="${id === k ? 'on' : ''}" data-id="${id}">${n}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach((b) => (b.onclick = () => show(b.dataset.id)));
  views[k]($('#view'));
}
show(current); ping();
