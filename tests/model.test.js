// Proves del model: node tests/model.test.js
const assert = require('assert');
const M = require('../js/model.js');

const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
let n = 0;
function test(name, fn) { fn(); n++; console.log('✓', name); }

test('RL sèrie: valors coneguts', () => {
  // R = 30 Ω, X_L = 40 Ω → Z = 50 Ω, I = 4,6 A, cos φ = 0,6
  const f = 50, L = 40 / (2 * Math.PI * f);
  const a = M.analyze({ V: 230, f, R: 30, L });
  assert(close(a.Z, 50));
  assert(close(a.I, 4.6));
  assert(close(a.pf, 0.6));
  assert(close(a.P, 634.8));
  assert(close(a.Q, 846.4));
  assert(close(a.S, 1058));
});

test('RLC: les reactàncies es resten', () => {
  const f = 50, w = 2 * Math.PI * f;
  const a = M.analyze({ V: 230, f, R: 30, L: 60 / w, Cs: 1 / (20 * w) });
  assert(close(a.X, 40));
  assert(close(a.Z, 50));
});

test('Compensació: P es manté i cos φ arriba a l\'objectiu', () => {
  const f = 50, L = 40 / (2 * Math.PI * f);
  const a = M.analyze({ V: 230, f, R: 30, L });
  const r = M.requiredCompensation({ P: a.P, Q: a.Q, V: 230, f, target: 0.95 });
  const b = M.analyze({ V: 230, f, R: 30, L, Cp: r.C });
  assert(close(b.P, a.P));
  assert(close(b.pf2, 0.95, 1e-9));
  assert(close(b.I2, r.I2));
  assert(b.I2 < a.I);
  assert.strictEqual(M.classify(b, 0.95), 'ok');
});

test('Classificació: insuficient, excessiva i sobrecompensada', () => {
  const f = 50, L = 40 / (2 * Math.PI * f);
  const base = M.analyze({ V: 230, f, R: 30, L });
  const r = M.requiredCompensation({ P: base.P, Q: base.Q, V: 230, f, target: 0.92 });
  const at = (C) => M.classify(M.analyze({ V: 230, f, R: 30, L, Cp: C }), 0.92);
  assert.strictEqual(at(r.C * 0.8), 'insuficient');
  const cFull = base.Q / (2 * Math.PI * f * 230 * 230);
  assert.strictEqual(at(cFull * 0.99), 'excessiva');
  assert.strictEqual(at(cFull * 1.3), 'sobre');
});

test('Generador: reproduïble i dins de rangs', () => {
  for (let seed = 1; seed <= 3000; seed++) {
    for (const t of ['RL', 'RLC', 'auto']) {
      const ex = M.generate(seed, t);
      assert.deepStrictEqual(ex, M.generate(seed, t));
      const s = M.solve(ex);
      assert(ex.target >= 0.9 && ex.target <= 0.95, 'objectiu');
      assert(s.a.X > 0, 'ha de ser inductiva');
      assert(s.a.pf >= 0.5 && s.a.pf <= ex.target - 0.06, `cos φ ${s.a.pf}`);
      assert(s.r.C > 0 && s.r.Qc > 0);
      assert(s.a.I <= 20);
      if (t !== 'auto') assert.strictEqual(ex.kind, t);
      if (ex.kind === 'RLC') assert(ex.Cs > 0); else assert.strictEqual(ex.Cs, 0);
    }
  }
});

test('El número sol identifica l\'exercici (tipus derivat de la llavor)', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const a = M.generate(seed, 'auto');
    assert.deepStrictEqual(a, M.generate(seed));
    kinds.add(a.kind);
  }
  assert.deepStrictEqual([...kinds].sort(), ['RL', 'RLC']);
});

test('Comprovació i pistes', () => {
  const ex = M.generate(42, 'RLC');
  const s = M.solve(ex);
  assert(M.check('C', s.answers.C * 1.015, s.answers.C));
  assert(!M.check('C', s.answers.C * 1.05, s.answers.C));
  assert(M.check('pf', Math.round(s.answers.pf * 100) / 100, s.answers.pf));
  assert(/2π/.test(M.hint('C', s.answers.C * 2 * Math.PI, ex, s)));
  assert(/resten/.test(M.hint('Z', Math.hypot(ex.R, s.a.XL + s.a.XC), ex, s)));
  assert(/tota la Q/.test(M.hint('Qc', s.a.Q, ex, s)));
});

console.log(`\n${n} proves superades`);
