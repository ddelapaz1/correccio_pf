/* Model de càlcul de la correcció del factor de potència (sense dependències del DOM).
   Unitats SI: V, Hz, Ω, H, F. Càrrega: R, L i C (opcional) en sèrie. Compensació: C en paral·lel. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.PFModel = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = 2 * Math.PI;

  /** Estat del circuit abans i després de connectar la capacitat de compensació Cp. */
  function analyze({ V, f, R, L, Cs = 0, Cp = 0 }) {
    const w = TAU * f;
    const XL = w * L;
    const XC = Cs > 0 ? 1 / (w * Cs) : 0;
    const X = XL - XC;
    const Z = Math.hypot(R, X);
    const I = V / Z;
    const P = I * I * R;
    const Q = I * I * X;
    const S = V * I;
    const phi = Math.atan2(X, R);
    const pf = R / Z;

    const Ic = V * w * Cp;
    const Qc = V * Ic;
    const Q2 = Q - Qc;
    const S2 = Math.hypot(P, Q2);
    const I2 = S2 / V;
    const phi2 = Math.atan2(Q2, P);
    const pf2 = P / S2;

    return { w, XL, XC, X, Z, I, P, Q, S, phi, pf, Ic, Qc, Q2, S2, I2, phi2, pf2 };
  }

  /** Potència reactiva i capacitat necessàries per passar de (P, Q) a cos φ' = target (inductiu). */
  function requiredCompensation({ P, Q, V, f, target }) {
    const w = TAU * f;
    const phiT = Math.acos(target);
    const QT = P * Math.tan(phiT);
    const Qc = Math.max(0, Q - QT);
    const C = Qc / (w * V * V);
    const I2 = Math.hypot(P, Q - Qc) / V;
    return { phiT, QT, Qc, C, I2 };
  }

  /** Classifica el resultat de la compensació. tol: marge en cos φ. */
  function classify({ pf2, Q2, P }, target, tol = 0.002) {
    if (Q2 < -1e-6 * P) return 'sobre';           // capacitiu: s'ha passat
    if (pf2 + tol < target) return 'insuficient';
    if (pf2 > 0.99 && target < 0.97) return 'excessiva'; // vàlida, però més C de la necessària
    return 'ok';
  }

  /* ---------- generador d'exercicis ---------- */

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const R_VALUES = [10, 12, 15, 18, 20, 22, 25, 27, 30, 33, 39, 40, 47, 50, 56];
  const CS_VALUES_UF = [22, 33, 47, 68, 100, 150, 220, 330, 470, 680];
  const TARGETS = [0.90, 0.91, 0.92, 0.93, 0.94, 0.95];

  /**
   * Genera un exercici reproduïble a partir d'una llavor.
   * type: 'RL' | 'RLC' | 'auto'
   */
  function generate(seed, type = 'auto') {
    const rand = rng(seed);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const V = 230, f = 50, w = TAU * f;
    const kind = type === 'auto' ? (rand() < 0.5 ? 'RL' : 'RLC') : type;
    const target = pick(TARGETS);

    for (let tries = 0; tries < 200; tries++) {
      const R = pick(R_VALUES);
      const pf0 = 0.55 + rand() * 0.27;          // 0,55 … 0,82
      const X = R * Math.tan(Math.acos(pf0));
      let Cs = 0, XL = X;
      if (kind === 'RLC') {
        const options = CS_VALUES_UF.filter((c) => {
          const xc = 1 / (w * c * 1e-6);
          return xc >= 0.25 * X && xc <= 1.2 * X;
        });
        if (!options.length) continue;
        Cs = pick(options) * 1e-6;
        XL = X + 1 / (w * Cs);
      }
      const LmH = XL / w * 1000;
      const L = (LmH >= 20 ? Math.round(LmH) : Math.round(LmH * 10) / 10) / 1000;
      const a = analyze({ V, f, R, L, Cs });
      if (a.X <= 0 || a.pf > target - 0.06 || a.pf < 0.5 || a.I > 20) continue;
      return { seed, kind, V, f, R, L, Cs, target };
    }
    // Valors segurs si no se n'ha trobat cap (no hauria de passar).
    return { seed, kind: 'RL', V, f, R: 20, L: 0.05, Cs: 0, target };
  }

  /** Totes les magnituds que l'alumne ha de calcular, amb valors exactes. */
  function solve(ex) {
    const a = analyze(ex);
    const r = requiredCompensation({ P: a.P, Q: a.Q, V: ex.V, f: ex.f, target: ex.target });
    return {
      a, r,
      answers: {
        Z: a.Z, I: a.I, pf: a.pf, P: a.P, Q: a.Q, S: a.S,
        Qc: r.Qc, C: r.C * 1e6, I2: r.I2,
      },
    };
  }

  /** Compara una resposta amb el valor correcte. */
  function check(key, value, correct) {
    if (!Number.isFinite(value)) return false;
    if (key === 'pf') return Math.abs(value - correct) <= 0.006;
    return Math.abs(value - correct) <= 0.02 * Math.abs(correct) + 1e-9;
  }

  /** Pistes per a errors habituals. Retorna un text o null. */
  function hint(key, value, ex, sol) {
    const near = (x, y) => Number.isFinite(y) && y !== 0 && Math.abs(x - y) <= 0.02 * Math.abs(y);
    const { a, r } = sol;
    const w = a.w;
    switch (key) {
      case 'Z':
        if (near(value, ex.R + Math.abs(a.X))) return 'La impedància no és la suma aritmètica: Z = √(R² + X²).';
        if (ex.Cs > 0 && near(value, Math.hypot(ex.R, a.XL + a.XC))) return 'Les reactàncies de la bobina i del condensador es resten: X = X_L − X_C.';
        if (near(value, Math.hypot(ex.R, ex.L * ex.f))) return 'Sembla que has fet X_L = L·f. Recorda que X_L = 2π·f·L.';
        return null;
      case 'I':
        if (near(value, ex.V / ex.R)) return 'Has dividit per R. El corrent el limita la impedància: I = V / Z.';
        return null;
      case 'pf':
        if (Math.abs(value - Math.abs(a.X) / a.Z) < 0.006) return 'Això és sin φ. El factor de potència és cos φ = R / Z = P / S.';
        if (value > 1) return 'El factor de potència no pot ser més gran que 1.';
        return null;
      case 'P':
        if (near(value, a.S)) return 'Això és la potència aparent. P = V·I·cos φ = R·I².';
        return null;
      case 'Q':
        if (near(value, a.S)) return 'Això és la potència aparent. Q = V·I·sin φ = X·I².';
        if (near(value, a.XL * a.I * a.I) && ex.Cs > 0) return 'Fes servir la reactància total X = X_L − X_C.';
        return null;
      case 'S':
        if (near(value, a.P + Math.abs(a.Q))) return 'Les potències no se sumen aritmèticament: S = √(P² + Q²) = V·I.';
        return null;
      case 'Qc':
        if (near(value, a.Q)) return 'Compensar tota la Q donaria cos φ\' = 1. Només cal Qc = P·(tg φ − tg φ\').';
        if (near(value, r.QT)) return 'Això és la Q que ha de quedar (Q\' = P·tg φ\'). La del condensador és Qc = Q − Q\'.';
        if (near(value, a.S * (Math.tan(a.phi) - Math.tan(r.phiT)))) return 'A la fórmula hi va P, no S: Qc = P·(tg φ − tg φ\').';
        return null;
      case 'C': {
        const cuF = r.C * 1e6;
        if (near(value, cuF * TAU)) return 'Sembla que has fet servir f en lloc de ω = 2π·f.';
        if (near(value * 1e6, cuF) || near(value / 1e6, cuF)) return 'Revisa les unitats: la resposta va en microfarads (µF).';
        if (near(value, (r.Qc / (w * ex.V)) * 1e6)) return 'La tensió va al quadrat: C = Qc / (ω·V²).';
        if (near(value, (a.Q / (w * ex.V * ex.V)) * 1e6)) return 'Has fet servir tota la Q de la càrrega en lloc de Qc.';
        return null;
      }
      case 'I2':
        if (near(value, a.I)) return 'Després de compensar, el corrent de línia disminueix: I\' = P / (V·cos φ\').';
        return null;
      default:
        return null;
    }
  }

  return { TAU, analyze, requiredCompensation, classify, generate, solve, check, hint, rng };
});
