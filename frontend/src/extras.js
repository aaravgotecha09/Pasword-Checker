import { api } from './api.js';
const $ = (s, r = document) => r.querySelector(s);
const tf = (b) => (b ? 'T' : 'F');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sci = (s) => (s.length > 15 ? `${s[0]}.${s.slice(1, 4)} × 10^${s.length - 1}` : s.replace(/\B(?=(\d{3})+(?!\d))/g, ','));

// ---- Innovation 1: live logic-gate circuit ----
export function circuit(r) {
  const ys = r.propositions.map((_, i) => 30 + i * 50);
  return `<div class="circ"><svg viewBox="0 0 660 260" role="img" aria-label="Five inputs feeding an AND gate">
  ${r.propositions.map((p, i) => `<g class="${p.active ? '' : 'off'}"><line class="w ${tf(p.value)}" x1="92" y1="${ys[i]}" x2="300" y2="${ys[i]}"/>
  <circle class="n ${tf(p.value)}" cx="70" cy="${ys[i]}" r="20"/><text class="nt" x="70" y="${ys[i] + 6}">${p.symbol}</text></g>`).join('')}
  <path class="gate" d="M300 15 H350 A115 115 0 0 1 350 245 H300 Z"/><text class="gt" x="352" y="136">AND</text>
  <line class="w ${tf(r.A)}" x1="465" y1="130" x2="555" y2="130"/><circle class="n bulb ${tf(r.A)}" cx="590" cy="130" r="32"/><text class="nt" x="590" y="138">A</text></svg></div>`;
}

export function deMorgan(r) {
  const a = r.propositions.filter((p) => p.active);
  return `De Morgan: ¬A ≡ ${a.map((p) => '¬' + p.symbol).join(' ∨ ')} · ` +
    (r.A ? 'every ¬ term is F, so ¬A is F and A stays T' : `${r.failed.map((f) => '¬' + f.symbol).join(', ')} is T, so ¬A is T and A is F`);
}

// ---- Innovation 2: counting principle, entropy, crack time, auto-fix ----
export async function strengthBox(el, pw, r, setPw) {
  el.innerHTML = `<div class="card2"><b>Counting principle lab</b><div id="sxo" class="mut">${pw ? 'Calculating…' : 'Type a password to estimate its search space.'}</div>
  <div class="row" style="margin-top:10px"><button class="g" id="fx">Fix it (minimal edits)</button><button class="g" id="gn">Generate strong one</button></div><div id="fxm" class="mut"></div></div>`;
  const act = (path, body, key) => async () => { try { const d = await api(path, body); setPw(d[key]); } catch (e) { $('#fxm').textContent = e.message; } };
  $('#fx').onclick = act('/api/fix', { password: pw, policy: r.policy }, 'fixed');
  $('#gn').onclick = act('/api/generate', {}, 'password');
  if (!pw) return;
  try {
    const d = await api('/api/strength', { password: pw });
    $('#sxo').innerHTML = `<div class="meter"><i style="width:${Math.min(100, (d.bits / 90) * 100)}%"></i></div>
    <p><b>${d.rating}</b> · ${d.bits} bits of entropy${d.listed ? ' (on the common list, so effectively 0)' : ''}</p>
    <p class="mut">Product rule: ${d.pool} = <b>${d.charset}</b> symbols, so ${d.charset}<sup>${d.length}</sup> ≈ 10<sup>${d.log10Space}</sup> possible strings.</p>
    <table><tbody>${d.crack.map((c) => `<tr><td style="text-align:left">${c.label}</td><td><b>${c.time}</b></td></tr>`).join('')}</tbody></table>`;
  } catch (e) { $('#sxo').innerHTML = `<span class="err">${esc(e.message)} (redeploy the new backend to unlock this panel)</span>`; }
}

// ---- Innovation 3: puzzle game (hit a target truth row; one level is provably impossible) ----
export async function puzzle(v) {
  let data;
  try { data = await api('/api/puzzles'); } catch (e) { v.innerHTML = `<div class="card"><div class="err">${esc(e.message)}. Redeploy the new backend to play.</div></div>`; return; }
  let solved = []; try { solved = JSON.parse(localStorage.getItem('ll-solved') || '[]'); } catch { /* storage blocked */ }
  let cur = 0;
  const done = (id) => { if (!solved.includes(id)) { solved.push(id); try { localStorage.setItem('ll-solved', JSON.stringify(solved)); } catch { /* ignore */ } } };
  const draw = () => {
    const L = data.levels[cur], T = [...L.target];
    v.innerHTML = `<div class="card"><h2>Break the gate · score ${solved.length * 100}/${data.levels.length * 100}</h2>
    <p class="mut">Craft a password whose truth values match the target row exactly. Use dummy passwords only.</p>
    <div class="row">${data.levels.map((l, i) => `<button class="g lv ${i === cur ? 'cur' : ''}" data-i="${i}">${solved.includes(l.id) ? '✓ ' : ''}Level ${l.id}</button>`).join('')}</div></div>
    <div class="card"><h2>${L.title}</h2><p class="mut">Target (p q r s t):</p>
    <div class="chips" style="grid-template-columns:repeat(5,1fr)">${T.map((x, i) => `<div class="chip ${x}"><div class="s">${'pqrst'[i]}</div><div class="v">${x}</div></div>`).join('')}</div>
    <div class="row"><input id="pz" type="text" placeholder="Try a password…" autocomplete="off" maxlength="64">${L.impossible ? '<button class="b" id="imp">It is impossible</button>' : ''}<button class="g" id="hint">Hint</button></div>
    <div id="live" class="chips" style="grid-template-columns:repeat(5,1fr)"></div><p id="msg" class="mut"></p></div>`;
    v.querySelectorAll('.lv').forEach((b) => (b.onclick = () => { cur = +b.dataset.i; draw(); }));
    $('#hint').onclick = () => ($('#msg').textContent = 'Hint: ' + L.hint);
    const win = (extra) => { done(L.id); $('#msg').innerHTML = `<b style="color:var(--ok)">Level cleared +100.</b> ${esc(L.why)} ${extra || ''}`; };
    if (L.impossible) $('#imp').onclick = () => (data.impossibleProved ? win('(Server verified: every blocklist word is alphanumeric.)') : ($('#msg').textContent = 'Not proven.'));
    $('#pz').oninput = async (e) => {
      try {
        const r = await api('/api/check', { password: e.target.value });
        const vec = r.propositions.map((p) => tf(p.value));
        $('#live').innerHTML = vec.map((x, i) => `<div class="chip ${x}"><div class="s">${'pqrst'[i]}</div><div class="v">${x}</div><small>${x === T[i] ? 'match' : 'differs'}</small></div>`).join('');
        if (vec.join('') === L.target) win();
      } catch (err) { $('#msg').textContent = err.message; }
    };
  };
  draw();
}

// ---- Innovation 4: inclusion-exclusion math lab ----
export function mathLab(v) {
  v.innerHTML = `<div class="card"><h2>How many passwords satisfy the policy?</h2>
  <p class="mut">Count strings of length n over 94 printable symbols (26 upper, 26 lower, 10 digits, 32 special) containing at least one uppercase (q), digit (r) and special (s), using the inclusion–exclusion principle.</p>
  <label class="chk">Length n = <b id="nv">10</b></label><input id="n" type="range" min="1" max="30" value="10" style="width:100%;accent-color:var(--acc)"><div id="ml"></div></div>`;
  const go = async () => {
    const n = +$('#n').value; $('#nv').textContent = n;
    try {
      const d = await api('/api/counting', { length: n });
      $('#ml').innerHTML = `<div class="chips"><div class="chip"><small>All strings (94<sup>n</sup>)</small><div class="v" style="font-size:20px">${sci(d.total)}</div></div>
      <div class="chip T"><small>Having q ∧ r ∧ s</small><div class="v" style="font-size:20px">${sci(d.satisfying)}</div></div>
      <div class="chip ${d.lengthOK ? 'T' : 'F'}"><small>${d.lengthOK ? 'p is TRUE (n ≥ 8)' : 'p is FALSE (n < 8): A fails'}</small><div class="v">${d.percent}%</div></div></div>
      <div class="tablewrap"><table><thead><tr><th>Term</th><th>Sign</th><th>Alphabet</th><th>Count</th></tr></thead><tbody>${d.terms.map((t) => `<tr><td style="text-align:left">${t.excluded}</td><td>${t.sign}</td><td>${t.alphabet}</td><td>${sci(t.count)}</td></tr>`).join('')}</tbody></table></div>
      <p class="mut">Formula: |U∩D∩S| = N − Σ|no X| + Σ|no X, no Y| − |no U, D, S|, where each term is (alphabet size)<sup>n</sup>.</p>`;
    } catch (e) { $('#ml').innerHTML = `<div class="err">${esc(e.message)}. Redeploy the new backend.</div>`; }
  };
  $('#n').oninput = go; go();
}
