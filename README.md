# Correcció del factor de potència

Laboratori interactiu en català per al mòdul **0962 Sistemes de potència** (RA1). Parteix d'una càrrega inductiva (RL o RLC sèrie) i hi afegeix condensadors en paral·lel per veure com canvien *Q*, *S*, *cos φ* i el corrent de línia. També permet calcular la capacitat necessària per arribar a un factor de potència objectiu.

Funciona íntegrament al navegador, sense dependències, comptes ni serveis externs.

**Aplicació publicada:** https://ddelapaz1.github.io/correccio_pf/

## Modes

### Exercici

- Es genera una càrrega **RL sèrie** o **RLC sèrie amb predomini inductiu** (X_L > X_C) connectada a 230 V i 50 Hz, amb un objectiu de *cos φ'* entre **0,90 i 0,95**.
- **Pas 1:** l'alumne calcula *Z*, *I*, *cos φ*, *P*, *Q* i *S*.
- **Pas 2:** l'alumne calcula *Qc*, *C* (en µF) i el corrent de línia compensat *I'*.
- **Comprova** valida cada resposta amb un marge del 2 % (±0,006 per a *cos φ*). Detecta errors habituals i hi dona una pista: sumar R + X, no restar X_L − X_C, fer servir *f* en lloc de *ω*, compensar tota la *Q*, posar *S* en lloc de *P*, no elevar *V* al quadrat, confondre les unitats de µF, etc.
- **Mostra la solució** fa la resolució pas a pas.
- **Pas 3:** el banc de condensadors es desbloqueja quan *Qc* i *C* són correctes o quan s'ha mostrat la solució. L'alumne combina condensadors comercials (1 a 100 µF) o hi posa un valor personalitzat. L'aplicació indica si la compensació és insuficient, correcta, excessiva (*cos φ'* ≈ 1) o sobrecompensada (capacitiva).
- Mentre no s'ha resolt el pas 1, l'aplicació no mostra els valors inicials, perquè l'alumne no pugui copiar-los.
- Cada exercici té un número. **Copia l'enllaç** genera una URL (`#ex=4821&t=RLC`) que obre el mateix exercici a tothom, per exemple per a una prova o una correcció conjunta.

### Exploració lliure

Té lliscadors per a *V*, *f*, *R*, *L*, el condensador en sèrie *Cs* i el *cos φ'* objectiu. Calcula *Qc* i *C* en temps real, i el botó «Posa aquesta C al banc» aplica directament la capacitat necessària.

## Visualitzacions

- Esquema del circuit amb amperímetre de línia i branca de compensació.
- Indicador de *cos φ* (inductiu ← 1 → capacitiu) amb la zona objectiu.
- Taula abans/després de *I*, *P*, *Q*, *S*, *cos φ* i *φ*, amb la variació percentual.
- Triangle de potències abans i després, amb *Qc*.
- Diagrama fasorial de *V*, *I* de la càrrega, *I_C* i *I* de línia.

## Model

Règim sinusoidal permanent amb components ideals:

- Z = √(R² + (X_L − X_C)²), I = V/Z, cos φ = R/Z
- P = R·I², Q = X·I², S = V·I
- Qc = P·(tg φ − tg φ'), C = Qc / (ω·V²), I' = P / (V·cos φ')

## Com executar-la

Obre `index.html` al navegador o serveix la carpeta amb qualsevol servidor estàtic:

```bash
python3 -m http.server 8000
```

Proves del model (necessiten Node):

```bash
node tests/model.test.js
```

## Estructura

```
index.html          interfície
css/styles.css      estils (tema clar i fosc)
js/model.js         càlculs, generador d'exercicis i pistes (sense DOM)
js/app.js           interacció i gràfiques SVG
tests/model.test.js proves del model
```
