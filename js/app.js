/* Interfície: exercicis generats, exploració lliure, banc de condensadors i gràfiques SVG. */
(function () {
  'use strict';
  const M = window.PFModel;
  const $ = (s) => document.querySelector(s);
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- format ---------- */
  const nf = (d) => new Intl.NumberFormat('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt = (x, d = 2) => nf(d).format(Math.abs(x) < 0.5 * 10 ** -d ? 0 : x);
  /** Xifres significatives: 3 per defecte, sense notació científica. */
  function sig(x, n = 3) {
    if (!Number.isFinite(x)) return '—';
    if (x === 0) return '0';
    const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x))));
    return fmt(x, Math.min(d, 4));
  }
  /** Com sig(), però sense zeros finals: per a dades i valors de components. */
  const sigT = (x, n = 3) => sig(x, n).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
  const deg = (r) => (r * 180) / Math.PI;
  function parseNum(s) {
    const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
    if (t === '') return NaN;
    return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? Number(t) : NaN;
  }
  const capLabel = (uF) => `${sigT(uF, 3)} µF`;

  /* ---------- estat ---------- */
  const CAPS = [1, 2.2, 4.7, 10, 22, 47, 100];
  const FIELDS_1 = [
    { k: 'Z', label: 'Impedància <var>Z</var>', unit: 'Ω' },
    { k: 'I', label: 'Corrent <var>I</var>', unit: 'A' },
    { k: 'pf', label: 'Factor de potència <var>cos φ</var>', unit: '—' },
    { k: 'P', label: 'Potència activa <var>P</var>', unit: 'W' },
    { k: 'Q', label: 'Potència reactiva <var>Q</var>', unit: 'var' },
    { k: 'S', label: 'Potència aparent <var>S</var>', unit: 'VA' },
  ];
  const FIELDS_2 = [
    { k: 'Qc', label: 'Reactiva dels condensadors <var>Q<sub>c</sub></var>', unit: 'var' },
    { k: 'C', label: 'Capacitat <var>C</var>', unit: 'µF' },
    { k: 'I2', label: 'Corrent de línia compensat <var>I\'</var>', unit: 'A', small: 'amb la C exacta' },
  ];

  const state = {
    mode: 'ex',
    ex: null, sol: null,
    exType: 'auto',
    ok: {}, revealed: false,
    bench: { ex: [], lab: [] },
    lab: { V: 230, f: 50, R: 20, L: 0.06, Cs: 0, target: 0.95 },
  };

  /* ---------- exercici ---------- */
  const MAX_SEED = 99999;
  function newSeed() { return 1 + Math.floor(Math.random() * MAX_SEED); }

  /** Nou exercici aleatori. El número sol ja identifica l'exercici: el tipus es deriva de la llavor. */
  function newExercise() {
    const want = $('#ex-type').value;
    let seed = newSeed();
    for (let i = 0; want !== 'auto' && i < 500 && M.generate(seed, 'auto').kind !== want; i++) seed = newSeed();
    loadExercise(seed, 'auto');
  }

  /** Obre l'exercici amb el número escrit per l'alumne o el professor. */
  function openByNumber() {
    const inp = $('#ex-num');
    const raw = inp.value.trim();
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < 1 || n > MAX_SEED) {
      $('#copy-msg').textContent = `Escriu un número enter entre 1 i ${MAX_SEED}.`;
      inp.focus();
      return;
    }
    setMode('ex');
    loadExercise(n, 'auto');
    inp.value = '';
    $('#copy-msg').textContent = `S'ha obert l'exercici ${n}.`;
  }

  /** type: 'auto' (normal) o un tipus forçat, només per als enllaços antics amb &t=RL|RLC. */
  function loadExercise(seed, type = 'auto') {
    state.exType = type;
    state.ex = M.generate(seed, type);
    state.sol = M.solve(state.ex);
    state.ok = {};
    state.revealed = false;
    state.bench.ex = [];
    if (type !== 'auto') $('#ex-type').value = type;
    try { history.replaceState(null, '', type === 'auto' ? `#ex=${seed}` : `#ex=${seed}&t=${type}`); } catch (e) { /* file:// */ }
    renderStatement();
    renderAnswers();
    $('#solution').hidden = true;
    $('#solution').innerHTML = '';
    $('#copy-msg').textContent = '';
    update();
  }

  function renderStatement() {
    const ex = state.ex;
    const L = ex.L * 1000;
    const parts = [
      `Una càrrega monofàsica està formada per una resistència de <b>R = ${sigT(ex.R, 3)} Ω</b>`,
      ex.Cs > 0
        ? ` en sèrie amb una bobina de <b>L = ${sigT(L, 3)} mH</b> i un condensador de <b>C<sub>s</sub> = ${sigT(ex.Cs * 1e6, 3)} µF</b>.`
        : ` en sèrie amb una bobina de <b>L = ${sigT(L, 3)} mH</b>.`,
      ` Es connecta a una xarxa de <b>${ex.V} V, ${ex.f} Hz</b>.`,
      ` Es vol corregir el factor de potència fins a <b>cos φ' = ${fmt(ex.target, 2)}</b> (inductiu) connectant condensadors en paral·lel amb la càrrega.`,
    ];
    $('#statement').innerHTML = parts.join('');
    $('#ex-code').textContent = `Exercici ${ex.seed}`;
    $('#pas2-text').innerHTML = `Objectiu: <var>cos φ'</var> = ${fmt(ex.target, 2)}. Calcula la reactiva que han d'aportar els condensadors, la capacitat necessària i el nou corrent de línia.`;
  }

  function fieldHTML(f) {
    return `<div class="ans" data-k="${f.k}">
      <label for="a-${f.k}">${f.label}${f.small ? `<small>${f.small}</small>` : ''}</label>
      <span class="unit-input"><input type="text" inputmode="decimal" id="a-${f.k}" autocomplete="off"><span>${f.unit}</span></span>
      <span class="mark" aria-hidden="true"></span>
      <p class="fb" id="fb-${f.k}"></p>
    </div>`;
  }

  function renderAnswers() {
    $('#answers-1').innerHTML = FIELDS_1.map(fieldHTML).join('');
    $('#answers-2').innerHTML = FIELDS_2.map(fieldHTML).join('');
    document.querySelectorAll('.ans input').forEach((inp) => {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswers(); });
      inp.addEventListener('input', () => {
        const row = inp.closest('.ans');
        row.classList.remove('ok', 'bad');
        row.querySelector('.mark').textContent = '';
        row.querySelector('.fb').textContent = '';
      });
    });
    updateBadges();
  }

  function checkAnswers() {
    const { answers } = state.sol;
    for (const f of [...FIELDS_1, ...FIELDS_2]) {
      const row = document.querySelector(`.ans[data-k="${f.k}"]`);
      const raw = row.querySelector('input').value;
      const v = parseNum(raw);
      const mark = row.querySelector('.mark');
      const fb = row.querySelector('.fb');
      row.classList.remove('ok', 'bad');
      fb.textContent = '';
      mark.textContent = '';
      if (raw.trim() === '') { delete state.ok[f.k]; continue; }
      if (!Number.isFinite(v)) {
        row.classList.add('bad'); mark.textContent = '✗';
        fb.textContent = 'Escriu només un número (p. ex. 12,5).';
        state.ok[f.k] = false;
        continue;
      }
      const good = M.check(f.k, v, answers[f.k]);
      state.ok[f.k] = good;
      row.classList.add(good ? 'ok' : 'bad');
      mark.textContent = good ? '✓' : '✗';
      if (!good) fb.textContent = M.hint(f.k, v, state.ex, state.sol) || 'Revisa el càlcul.';
    }
    updateBadges();
    update();
  }

  const step1ok = () => FIELDS_1.every((f) => state.ok[f.k]);
  const step2ok = () => state.ok.Qc && state.ok.C;
  const benchUnlocked = () => state.mode === 'lab' || state.revealed || step2ok();
  const initialVisible = () => state.mode === 'lab' || state.revealed || step1ok() || step2ok();

  function updateBadges() {
    const b = (id, fields) => {
      const n = fields.filter((f) => state.ok[f.k]).length;
      const el = $(id);
      el.className = 'badge';
      if (n === fields.length) { el.textContent = 'Correcte ✓'; el.classList.add('ok'); }
      else if (n > 0) { el.textContent = `${n}/${fields.length} correctes`; el.classList.add('part'); }
      else el.textContent = '';
    };
    b('#badge-1', FIELDS_1);
    b('#badge-2', FIELDS_2);
  }

  function renderSolution() {
    const ex = state.ex, { a, r } = state.sol;
    const res = (x, u) => `<span class="res">${x}${u ? ' ' + u : ''}</span>`;
    const steps1 = [
      `<var>ω</var> = 2π · ${ex.f} = ${res(fmt(a.w, 2), 'rad/s')}`,
      `<var>X<sub>L</sub></var> = <var>ωL</var> = ${fmt(a.w, 2)} · ${sigT(ex.L * 1000, 3)}·10⁻³ = ${res(sig(a.XL, 4), 'Ω')}`,
    ];
    if (ex.Cs > 0) {
      steps1.push(`<var>X<sub>C</sub></var> = 1 / (<var>ωC<sub>s</sub></var>) = 1 / (${fmt(a.w, 2)} · ${sigT(ex.Cs * 1e6, 3)}·10⁻⁶) = ${res(sig(a.XC, 4), 'Ω')}`);
      steps1.push(`<var>X</var> = <var>X<sub>L</sub></var> − <var>X<sub>C</sub></var> = ${res(sig(a.X, 4), 'Ω')}`);
    }
    steps1.push(
      `<var>Z</var> = √(${sigT(ex.R, 3)}² + ${sig(a.X, 4)}²) = ${res(sig(a.Z, 4), 'Ω')}`,
      `<var>I</var> = <var>V</var> / <var>Z</var> = ${ex.V} / ${sig(a.Z, 4)} = ${res(sig(a.I, 4), 'A')}`,
      `<var>cos φ</var> = <var>R</var> / <var>Z</var> = ${res(fmt(a.pf, 3))} → <var>φ</var> = ${fmt(deg(a.phi), 2)}°`,
      `<var>P</var> = <var>R I</var>² = ${res(sig(a.P, 4), 'W')}`,
      `<var>Q</var> = <var>X I</var>² = ${res(sig(a.Q, 4), 'var')}`,
      `<var>S</var> = <var>V I</var> = ${res(sig(a.S, 4), 'VA')}`,
    );
    const steps2 = [
      `<var>φ'</var> = arccos ${fmt(ex.target, 2)} = ${fmt(deg(r.phiT), 2)}° → tg φ' = ${fmt(Math.tan(r.phiT), 4)} (tg φ = ${fmt(Math.tan(a.phi), 4)})`,
      `<var>Q<sub>c</sub></var> = <var>P</var> (tg φ − tg φ') = ${sig(a.P, 4)} · (${fmt(Math.tan(a.phi), 4)} − ${fmt(Math.tan(r.phiT), 4)}) = ${res(sig(r.Qc, 4), 'var')}`,
      `<var>C</var> = <var>Q<sub>c</sub></var> / (<var>ω V</var>²) = ${sig(r.Qc, 4)} / (${fmt(a.w, 2)} · ${ex.V}²) = ${res(sig(r.C * 1e6, 4), 'µF')}`,
      `<var>I'</var> = <var>P</var> / (<var>V</var> cos φ') = ${sig(a.P, 4)} / (${ex.V} · ${fmt(ex.target, 2)}) = ${res(sig(r.I2, 4), 'A')} (abans ${sig(a.I, 3)} A)`,
    ];
    $('#solution').innerHTML =
      `<h3>Pas 1 · Estat inicial</h3><ol>${steps1.map((s) => `<li>${s}</li>`).join('')}</ol>` +
      `<h3>Pas 2 · Compensació</h3><ol>${steps2.map((s) => `<li>${s}</li>`).join('')}</ol>`;
    $('#solution').hidden = false;
  }

  /* ---------- paràmetres actuals ---------- */
  function current() {
    if (state.mode === 'ex') return { ...state.ex };
    const l = state.lab;
    return { V: l.V, f: l.f, R: l.R, L: l.L, Cs: l.Cs, target: l.target, kind: l.Cs > 0 ? 'RLC' : 'RL' };
  }
  const bench = () => state.bench[state.mode];
  const benchTotal = () => bench().reduce((s, c) => s + c, 0);

  /* ---------- actualització general ---------- */
  function update() {
    const p = current();
    const Cp = benchTotal() * 1e-6;
    const a = M.analyze({ ...p, Cp });
    const need = M.requiredCompensation({ P: a.P, Q: a.Q, V: p.V, f: p.f, target: p.target });
    const vis = initialVisible();
    const unl = benchUnlocked();

    // banc
    $('.bench').classList.toggle('locked', !unl);
    $('#bench-lock').hidden = unl;
    $('#c-total').textContent = `C total = ${capLabel(benchTotal())}`;
    $('#chips').innerHTML = bench().map((c, i) => `<button class="chip" type="button" data-i="${i}" title="Treu aquest condensador">${capLabel(c)}</button>`).join('');
    renderVerdict(a, need, p, unl);

    // exploració
    if (state.mode === 'lab') {
      $('#need-Qc').textContent = a.Q <= 0 ? '—' : `${sig(need.Qc, 4)} var`;
      $('#need-C').textContent = a.Q <= 0 ? '—' : capLabel(need.C * 1e6);
      $('#apply-need').disabled = !(a.Q > 0 && need.C > 0);
      $('#lab-note').textContent = a.Q <= 0
        ? 'Amb aquests valors la càrrega ja és capacitiva (X_C > X_L): afegir condensadors l\'empitjoraria.'
        : (a.pf >= p.target ? 'La càrrega ja compleix l\'objectiu sense compensar.' : '');
    }

    drawCircuit(p, a, Cp, vis);
    drawMeter(a, p.target, vis, unl);
    renderTable(a, vis, unl);
    drawTriangle(a, vis, unl);
    drawPhasors(a, vis, unl);
  }

  function renderVerdict(a, need, p, unl) {
    const el = $('#verdict');
    el.className = 'verdict';
    if (!unl || bench().length === 0 || a.Q <= 0) { el.innerHTML = ''; return; }
    const st = M.classify(a, p.target);
    const needUF = need.C * 1e6, have = benchTotal();
    const diff = Math.abs(have - needUF);
    const pfTxt = `cos φ' = ${fmt(a.pf2, 3)} ${a.Q2 < 0 ? '(capacitiu)' : '(inductiu)'}`;
    const msgs = {
      insuficient: ['warn', 'Encara no arribes a l\'objectiu', `${pfTxt} < ${fmt(p.target, 2)}. Et falten uns ${capLabel(diff)}.`],
      ok: ['ok', 'Objectiu assolit', `${pfTxt} ≥ ${fmt(p.target, 2)} amb ${capLabel(have)} (mínim necessari: ${capLabel(needUF)}). El corrent de línia ha baixat de ${sig(a.I, 3)} A a ${sig(a.I2, 3)} A.`],
      excessiva: ['warn', 'Objectiu assolit, però amb massa capacitat', `${pfTxt}. N'hi hauria prou amb ${capLabel(needUF)}: més condensadors encareixen la bateria i, si la càrrega baixa, la instal·lació pot quedar capacitiva.`],
      sobre: ['bad', 'Sobrecompensat: ara la instal·lació és capacitiva', `${pfTxt}. Els condensadors aporten més reactiva (${sig(a.Qc, 3)} var) de la que consumeix la càrrega (${sig(a.Q, 3)} var). Per arribar just a l'objectiu en calen ${capLabel(needUF)}.`],
    };
    const [cls, title, body] = msgs[st];
    el.classList.add(cls);
    el.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
  }

  /* ---------- taula de mesures ---------- */
  function renderTable(a, vis, unl) {
    const H = '<span class="hid">?</span>';
    const rows = [
      ['Corrent de línia <var>I</var>', a.I, a.I2, 'A', true],
      ['Potència activa <var>P</var>', a.P, a.P, 'W', true],
      ['Potència reactiva <var>Q</var>', a.Q, a.Q2, 'var', true],
      ['Potència aparent <var>S</var>', a.S, a.S2, 'VA', true],
      ['Factor de potència <var>cos φ</var>', a.pf, a.pf2, '', false],
      ['Angle <var>φ</var>', deg(a.phi), deg(a.phi2), '°', false],
    ];
    const comp = unl && bench().length > 0;
    $('#meas-body').innerHTML = rows.map(([name, b, c, u, pct], idx) => {
      const isPf = idx === 4;
      const f = (x) => (isPf ? fmt(x, 3) : idx === 5 ? fmt(x, 1) : sig(x, 4)) + (u ? ` ${u}` : '');
      let delta = '';
      if (vis && comp) {
        if (Math.abs(c - b) < 1e-9 * Math.max(1, Math.abs(b))) delta = '<span class="same">=</span>';
        else if (pct && b !== 0) {
          const d = ((c - b) / Math.abs(b)) * 100;
          delta = `<span class="${d < 0 ? 'down' : 'up'}">${d > 0 ? '+' : ''}${fmt(d, 1)} %</span>`;
        } else delta = `<span class="${isPf ? (c > b ? 'down' : 'up') : 'same'}">${c > b ? '▲' : '▼'}</span>`;
      }
      const after = !unl ? '—' : !vis ? H : comp ? f(c) : '<span class="hid">sense C</span>';
      return `<tr><td>${name}</td><td>${vis ? f(b) : H}</td><td>${after}</td><td>${delta}</td></tr>`;
    }).join('');
  }

  /* ---------- SVG ---------- */
  function el(tag, attrs = {}, text) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); return svg; }
  const css = (name) => `var(--${name})`;

  function arrow(g, x1, y1, x2, y2, color, { dash, width = 2.5, head = 9 } = {}) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const h = Math.min(head, len * 0.5);
    const bx = x2 - ux * h, by = y2 - uy * h;
    g.appendChild(el('line', { x1, y1, x2: bx, y2: by, stroke: color, 'stroke-width': width, 'stroke-dasharray': dash, 'stroke-linecap': 'round' }));
    const px = -uy * h * 0.45, py = ux * h * 0.45;
    g.appendChild(el('polygon', { points: `${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`, fill: color }));
  }

  function drawCircuit(p, a, Cp, vis) {
    const s = clear($('#circuit'));
    const W = { stroke: css('ink'), 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const yT = 40, yB = 190, xS = 60, xC = 270, xL = 420;
    // fils
    s.appendChild(el('path', { ...W, d: `M${xS} ${115 - 24} V${yT} H${xL} M${xS} ${115 + 24} V${yB} H${xL}` }));
    // font
    s.appendChild(el('circle', { cx: xS, cy: 115, r: 24, ...W }));
    s.appendChild(el('path', { ...W, d: `M${xS - 13} 115 c4 -12 9 -12 13 0 s9 12 13 0` }));
    s.appendChild(el('text', { x: xS + 34, y: 110, class: 'mono' }, `${p.V} V`));
    s.appendChild(el('text', { x: xS + 34, y: 128, class: 'mono muted' }, `${p.f} Hz`));
    // amperímetre
    const xA = 150;
    s.appendChild(el('circle', { cx: xA, cy: yT, r: 15, fill: css('panel'), stroke: css('ink'), 'stroke-width': 2 }));
    s.appendChild(el('text', { x: xA, y: yT + 5, 'text-anchor': 'middle', 'font-weight': 600 }, 'A'));
    s.appendChild(el('text', { x: xA, y: 18, 'text-anchor': 'middle', class: 'mono' }, vis ? `I = ${sig(a.I2, 3)} A` : 'I = ?'));
    // branca de compensació
    const on = Cp > 0;
    const gC = el('g', { opacity: on ? 1 : 0.35 });
    const cw = { ...W, stroke: css('c'), 'stroke-dasharray': on ? null : '4 4' };
    gC.appendChild(el('path', { ...cw, d: `M${xC} ${yT} V108 M${xC} 122 V${yB}` }));
    gC.appendChild(el('path', { ...cw, 'stroke-width': 3, 'stroke-dasharray': null, d: `M${xC - 18} 108 H${xC + 18} M${xC - 18} 122 H${xC + 18}` }));
    gC.appendChild(el('text', { x: xC + 26, y: 112, class: 'mono', fill: css('c') }, on ? `C = ${capLabel(Cp * 1e6)}` : 'sense C'));
    if (on && vis) label(gC, xC + 26, 132, ['I', { sub: 'C' }, ` = ${sig(a.Ic, 3)} A`], { class: 'mono muted' });
    s.appendChild(gC);
    for (const y of [yT, yB]) s.appendChild(el('circle', { cx: xC, cy: y, r: 3.5, fill: css('ink') }));
    // càrrega
    const rlc = p.Cs > 0;
    s.appendChild(el('rect', { x: xL - 20, y: 50, width: 132, height: 132, rx: 8, fill: 'none', stroke: css('muted'), 'stroke-dasharray': '3 4' }));
    s.appendChild(el('text', { x: xL + 110, y: 200, 'text-anchor': 'end', class: 'muted', 'font-size': 11.5, 'letter-spacing': '.08em' }, 'CÀRREGA'));
    const yR1 = 58, yR2 = 88, yL1 = 98, yL2 = rlc ? 138 : 150;
    s.appendChild(el('path', { ...W, d: `M${xL} ${yT} V${yR1} M${xL} ${yR2} V${yL1}` }));
    s.appendChild(el('rect', { x: xL - 8, y: yR1, width: 16, height: yR2 - yR1, fill: css('panel'), stroke: css('ink'), 'stroke-width': 2 }));
    const n = 4, hh = (yL2 - yL1) / n / 2;
    let d = `M${xL} ${yL1}`;
    for (let i = 0; i < n; i++) d += ` a${hh} ${hh} 0 0 1 0 ${2 * hh}`;
    s.appendChild(el('path', { ...W, d }));
    const lbl = (y, t) => s.appendChild(el('text', { x: xL + 18, y, class: 'mono' }, t));
    lbl(yR1 + 20, `R = ${sigT(p.R, 3)} Ω`);
    lbl((yL1 + yL2) / 2 + 5, `L = ${sigT(p.L * 1000, 3)} mH`);
    if (rlc) {
      s.appendChild(el('path', { ...W, d: `M${xL} ${yL2} V150 M${xL} 160 V${yB}` }));
      s.appendChild(el('path', { ...W, 'stroke-width': 3, d: `M${xL - 12} 150 H${xL + 12} M${xL - 12} 160 H${xL + 12}` }));
      lbl(160, `Cₛ = ${capLabel(p.Cs * 1e6)}`);
    } else {
      s.appendChild(el('path', { ...W, d: `M${xL} ${yL2} V${yB}` }));
    }
    s.appendChild(el('text', { x: xC, y: 222, 'text-anchor': 'middle', class: 'muted', 'font-size': 12.5 }, 'Condensadors en paral·lel amb la càrrega'));
  }

  function drawMeter(a, target, vis, unl) {
    const s = clear($('#pfmeter'));
    const x0 = 20, x1 = 420, xm = 220, y = 52;
    const pos = (pf, cap) => {
      const t = (Math.min(1, Math.max(0.5, pf)) - 0.5) / 0.5;
      return cap ? x1 - t * (x1 - xm) : x0 + t * (xm - x0);
    };
    s.appendChild(el('rect', { x: x0, y: y - 5, width: x1 - x0, height: 10, rx: 5, fill: css('soft') }));
    s.appendChild(el('rect', { x: pos(target, false), y: y - 5, width: xm - pos(target, false), height: 10, fill: css('ok'), opacity: 0.35 }));
    s.appendChild(el('line', { x1: pos(target, false), y1: y - 12, x2: pos(target, false), y2: y + 12, stroke: css('ok'), 'stroke-width': 2 }));
    s.appendChild(el('text', { x: pos(target, false), y: y - 16, 'text-anchor': 'end', fill: css('ok'), 'font-size': 13 }, `objectiu ${fmt(target, 2)}`));
    for (const v of [0.5, 0.7, 0.9, 1]) {
      for (const cap of v === 1 ? [false] : [false, true]) {
        const x = pos(v, cap);
        s.appendChild(el('line', { x1: x, y1: y + 6, x2: x, y2: y + 11, stroke: css('muted') }));
        s.appendChild(el('text', { x, y: y + 26, 'text-anchor': 'middle', class: 'mono muted', 'font-size': 13 }, fmt(v, 1)));
      }
    }
    for (const v of [0.6, 0.8]) for (const cap of [false, true]) {
      const x = pos(v, cap);
      s.appendChild(el('line', { x1: x, y1: y + 6, x2: x, y2: y + 9, stroke: css('muted') }));
    }
    s.appendChild(el('text', { x: x0, y: y + 44, class: 'muted', 'font-size': 13 }, '← inductiu'));
    s.appendChild(el('text', { x: x1, y: y + 44, 'text-anchor': 'end', class: 'muted', 'font-size': 13 }, 'capacitiu →'));
    s.appendChild(el('text', { x: x0, y: 16, 'font-weight': 600, 'font-size': 14 }, 'cos φ'));
    if (!vis) {
      s.appendChild(el('text', { x: x1, y: 16, 'text-anchor': 'end', class: 'muted', 'font-size': 13 }, 'Calcula el pas 1 per veure-ho'));
      return;
    }
    const xb = pos(a.pf, a.Q < 0);
    s.appendChild(el('circle', { cx: xb, cy: y, r: 7, fill: css('panel'), stroke: css('muted'), 'stroke-width': 2.5 }));
    const comp = unl && bench().length > 0;
    if (comp) {
      const xa = pos(a.pf2, a.Q2 < 0);
      s.appendChild(el('path', { d: `M${xa} ${y - 4} l-8 -12 h16 z`, fill: css('ink') }));
      s.appendChild(el('circle', { cx: xa, cy: y, r: 5, fill: css('ink') }));
    }
    s.appendChild(el('text', { x: x1, y: 16, 'text-anchor': 'end', class: 'mono', 'font-size': 14 },
      comp ? `${fmt(a.pf, 3)} → ${fmt(a.pf2, 3)}${a.Q2 < 0 ? ' cap.' : ''}` : fmt(a.pf, 3)));
  }

  function placeholder(svg, w, h, msg) {
    svg.appendChild(el('rect', { x: 10, y: 10, width: w - 20, height: h - 20, rx: 10, fill: 'none', stroke: css('rule'), 'stroke-dasharray': '4 5' }));
    const lines = msg.split('\n');
    lines.forEach((t, i) => svg.appendChild(el('text', { x: w / 2, y: h / 2 + (i - (lines.length - 1) / 2) * 20, 'text-anchor': 'middle', class: 'muted' }, t)));
  }

  /** Text amb subíndexs: parts = ['I', {sub: 'C'}, ' = 3 A']. */
  function label(parent, x, y, parts, attrs = {}) {
    const t = el('text', { x, y, ...attrs });
    for (const part of parts) {
      if (typeof part === 'string') t.appendChild(document.createTextNode(part));
      else {
        t.appendChild(el('tspan', { 'baseline-shift': 'sub', 'font-size': '0.75em' }, part.sub));
        t.appendChild(el('tspan', { dx: 1 }, ''));
      }
    }
    parent.appendChild(t);
    return t;
  }

  function drawTriangle(a, vis, unl) {
    const s = clear($('#triangle'));
    const W = 440, H = 300;
    if (!vis) return placeholder(s, W, H, 'Calcula correctament el pas 1\nper veure el triangle de potències');
    if (a.Q <= 0) return placeholder(s, W, H, 'La càrrega és capacitiva:\nno es compensa amb condensadors');
    const comp = unl && bench().length > 0;
    const Q2 = comp ? a.Q2 : a.Q;
    const qNeg = Math.max(0, -Q2);
    const k = Math.min(250 / a.P, 220 / (a.Q + qNeg));
    const ox = 40, oy = 40 + a.Q * k + Math.max(0, (220 - (a.Q + qNeg) * k) / 2);
    const X = ox + a.P * k;
    const yQ = oy - a.Q * k, yQ2 = oy - Q2 * k;
    const g = el('g');
    s.appendChild(g);
    const fs = { 'font-size': 13 };
    // sense compensar
    arrow(g, ox, oy, X, yQ, css('muted'), { dash: '6 5', width: 2 });
    arrow(g, X, oy, X, yQ, css('muted'), { dash: '6 5', width: 2 });
    arrow(g, ox, oy, X, oy, css('p'), { width: 3 });
    label(g, (ox + X) / 2, oy + (Q2 < 0 ? -10 : 22), ['P = ' + sig(a.P, 3) + ' W'], { ...fs, 'text-anchor': 'middle', fill: css('p'), 'font-weight': 600 });
    label(g, X, yQ - 10, ['Q = ' + sig(a.Q, 3) + ' var'], { ...fs, 'text-anchor': 'middle', fill: css('muted') });
    const sa = Math.atan2(a.Q * k, a.P * k);
    label(g, (ox + X) / 2 - 10 * Math.sin(sa), (oy + yQ) / 2 - 10 * Math.cos(sa), ['S = ' + sig(a.S, 3) + ' VA'], { ...fs, 'text-anchor': 'end', fill: css('muted') });
    if (comp) {
      arrow(g, ox, oy, X, yQ2, css('p'), { width: 3 });
      if (Math.abs(Q2) * k > 2) arrow(g, X, oy, X, yQ2, css('q'), { width: 3 });
      arrow(g, X + 16, yQ, X + 16, yQ2, css('c'), { width: 3 });
      label(g, X + 24, Math.min((yQ + yQ2) / 2, yQ + 40) + 4, ['Q', { sub: 'c' }, ' = ' + sig(a.Qc, 3) + ' var'], { ...fs, fill: css('c'), 'font-weight': 600 });
      if (Q2 >= 0) label(g, X + 10, Math.max((oy + yQ2) / 2 + 4, yQ2 + 14), ["Q' = " + sig(Q2, 3) + ' var'], { ...fs, fill: css('q'), 'font-weight': 600 });
      else label(g, X - 8, yQ2 + 4, ["Q' = " + sig(Q2, 3) + ' var'], { ...fs, 'text-anchor': 'end', fill: css('q'), 'font-weight': 600 });
      const sb = Math.atan2(Q2 * k, a.P * k);
      const mx = (ox + X) / 2, my = (oy + yQ2) / 2;
      label(g, mx + 14 * Math.sin(sb) + 6, my + 14 * Math.cos(sb) + 4, ["S' = " + sig(a.S2, 3) + ' VA'], { ...fs, fill: css('ink'), 'font-weight': 600 });
    }
    const ang = (phi, r, color, txt) => {
      const ex = ox + r * Math.cos(phi), ey = oy - r * Math.sin(phi);
      g.appendChild(el('path', { d: `M${ox + r} ${oy} A${r} ${r} 0 0 ${phi > 0 ? 0 : 1} ${ex} ${ey}`, fill: 'none', stroke: color, 'stroke-width': 1.5 }));
      const lr = r + 12, la = phi / 2;
      g.appendChild(el('text', { x: ox + lr * Math.cos(la), y: oy - lr * Math.sin(la) + 5, class: 'math', fill: color }, txt));
    };
    ang(a.phi, 34, css('muted'), 'φ');
    if (comp && Math.abs(a.phi2) > 0.03) ang(a.phi2, 62, css('ink'), "φ'");
  }

  function drawPhasors(a, vis, unl) {
    const s = clear($('#phasors'));
    const W = 440, H = 280;
    if (!vis) return placeholder(s, W, H, 'Calcula correctament el pas 1\nper veure els fasors');
    const comp = unl && bench().length > 0;
    const IL = { x: a.I * Math.cos(a.phi), y: a.I * Math.sin(a.phi) };   // y positiu = endarrerit (cap avall)
    const IC = { x: 0, y: comp ? -a.Ic : 0 };
    const IT = { x: IL.x + IC.x, y: IL.y + IC.y };
    const up = Math.max(0, -IC.y, -IT.y), down = Math.max(0, IL.y, IT.y);
    const k = Math.min(290 / Math.max(IL.x, IT.x, 1e-9), 220 / Math.max(up + down, 1e-9));
    const ox = 40, oy = 30 + up * k + Math.max(0, (220 - (up + down) * k) / 2);
    const P = (v) => [ox + v.x * k, oy + v.y * k];
    const fs = { 'font-size': 13 };
    s.appendChild(el('line', { x1: ox, y1: 12, x2: ox, y2: H - 12, stroke: css('rule') }));
    s.appendChild(el('line', { x1: ox - 10, y1: oy, x2: W - 10, y2: oy, stroke: css('rule') }));
    arrow(s, ox, oy, W - 30, oy, css('v'), { width: 3 });
    s.appendChild(el('text', { x: W - 26, y: oy - 8, 'text-anchor': 'end', fill: css('v'), class: 'math' }, 'V'));
    const [xl, yl] = P(IL);
    arrow(s, ox, oy, xl, yl, css('i'), { width: 3 });
    label(s, xl - 10, yl + 5, ['I = ' + sig(a.I, 3) + ' A'], { ...fs, 'text-anchor': 'end', fill: css('i') });
    if (comp) {
      const [xc, yc] = P(IC);
      arrow(s, ox, oy, xc, yc, css('c'), { width: 3 });
      label(s, xc + 8, Math.max(yc + 10, 18), ['I', { sub: 'C' }, ' = ' + sig(a.Ic, 3) + ' A'], { ...fs, fill: css('c') });
      const [xt, yt] = P(IT);
      arrow(s, xl, yl, xt, yt, css('c'), { width: 1.5, dash: '4 4', head: 7 });
      arrow(s, ox, oy, xt, yt, css('line'), { width: 3 });
      label(s, xt + 8, yt + 4, ["I' = " + sig(a.I2, 3) + ' A'], { ...fs, fill: css('line'), 'font-weight': 600 });
    }
    const r = 46;
    s.appendChild(el('path', { d: `M${ox + r} ${oy} A${r} ${r} 0 0 1 ${ox + r * Math.cos(a.phi)} ${oy + r * Math.sin(a.phi)}`, fill: 'none', stroke: css('muted'), 'stroke-width': 1.5 }));
    s.appendChild(el('text', { x: ox + (r + 10) * Math.cos(a.phi / 2), y: oy + (r + 10) * Math.sin(a.phi / 2) + 5, class: 'math muted' }, 'φ'));
    s.appendChild(el('text', { x: W - 10, y: 16, 'text-anchor': 'end', class: 'muted', 'font-size': 11.5 }, 'Tensió i corrents a escales diferents'));
  }

  /* ---------- mode ---------- */
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.modes button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    document.querySelectorAll('[data-show]').forEach((n) => { n.hidden = n.dataset.show !== mode; });
    if (mode === 'lab') syncLab();
    update();
  }

  function syncLab() {
    const l = state.lab;
    l.V = Number($('#lab-V').value);
    l.f = Number($('#lab-f').value);
    l.R = Number($('#lab-R').value);
    l.L = Number($('#lab-L').value) / 1000;
    l.Cs = Number($('#lab-Cs').value) * 1e-6;
    l.target = Number($('#lab-T').value);
    $('#o-R').textContent = `${l.R} Ω`;
    $('#o-L').textContent = `${Math.round(l.L * 1000)} mH`;
    $('#o-Cs').textContent = l.Cs > 0 ? capLabel(l.Cs * 1e6) : 'cap';
    $('#o-T').textContent = fmt(l.target, 2);
  }

  /* ---------- esdeveniments ---------- */
  function addCap(uF) {
    if (!(uF > 0) || bench().length >= 40) return;
    bench().push(uF);
    update();
  }

  function init() {
    $('#cap-buttons').innerHTML = CAPS.map((c) => `<button class="btn" type="button" data-c="${c}">${capLabel(c)}</button>`).join('');
    $('#cap-buttons').addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (b) addCap(Number(b.dataset.c));
    });
    const addCustom = () => {
      const v = parseNum($('#cap-custom').value);
      if (v > 0 && v <= 5000) { addCap(v); $('#cap-custom').value = ''; }
      else $('#cap-custom').focus();
    };
    $('#cap-add').addEventListener('click', addCustom);
    $('#cap-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustom(); });
    $('#cap-clear').addEventListener('click', () => { state.bench[state.mode] = []; update(); });
    $('#chips').addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      bench().splice(Number(c.dataset.i), 1);
      update();
    });

    $('#check').addEventListener('click', checkAnswers);
    $('#show-sol').addEventListener('click', () => { state.revealed = true; renderSolution(); update(); });
    $('#clear-ans').addEventListener('click', () => {
      state.ok = {};
      document.querySelectorAll('.ans input').forEach((i) => { i.value = ''; });
      document.querySelectorAll('.ans').forEach((r) => { r.classList.remove('ok', 'bad'); r.querySelector('.mark').textContent = ''; r.querySelector('.fb').textContent = ''; });
      updateBadges(); update();
    });
    $('#new-ex').addEventListener('click', newExercise);
    $('#ex-type').addEventListener('change', newExercise);
    $('#open-ex').addEventListener('click', openByNumber);
    $('#ex-num').addEventListener('keydown', (e) => { if (e.key === 'Enter') openByNumber(); });
    $('#copy-link').addEventListener('click', async () => {
      const url = location.href;
      try { await navigator.clipboard.writeText(url); $('#copy-msg').textContent = 'Enllaç copiat. Qui l\'obri veurà aquest mateix exercici.'; }
      catch (e) { $('#copy-msg').textContent = `Copia aquest enllaç: ${url}`; }
    });

    document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    ['#lab-V', '#lab-f', '#lab-R', '#lab-L', '#lab-Cs', '#lab-T'].forEach((id) => $(id).addEventListener('input', () => { syncLab(); update(); }));
    $('#apply-need').addEventListener('click', () => {
      const p = current();
      const a = M.analyze(p);
      const need = M.requiredCompensation({ P: a.P, Q: a.Q, V: p.V, f: p.f, target: p.target });
      state.bench.lab = need.C > 0 ? [Math.round(need.C * 1e6 * 100) / 100] : [];
      update();
    });

    $('#theme').addEventListener('click', () => {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('cpf-theme', root.dataset.theme); } catch (e) { /* res */ }
    });

    syncLab();
    const m = /ex=(\d+)(?:&t=(RLC|RL|auto))?/.exec(location.hash);
    if (m) loadExercise(Number(m[1]), m[2] || 'auto');
    else newExercise();
  }

  window.addEventListener('hashchange', () => {
    const m = /ex=(\d+)(?:&t=(RLC|RL|auto))?/.exec(location.hash);
    if (m && (!state.ex || Number(m[1]) !== state.ex.seed || (m[2] || 'auto') !== state.exType)) {
      setMode('ex');
      loadExercise(Number(m[1]), m[2] || 'auto');
    }
  });

  init();
})();
