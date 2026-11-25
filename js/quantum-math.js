/**
 * QuantumMath: Motor de Álgebra Lineal Compleja, Notación de Dirac,
 * Matrices Unitarias y Simulación de Estados de Hilbert.
 * Codex Layer 4 - Quantum Transpiler Core
 */

class Complex {
  constructor(re = 0, im = 0) {
    this.re = Number(re);
    this.im = Number(im);
  }

  static from(val) {
    if (val instanceof Complex) return new Complex(val.re, val.im);
    if (typeof val === 'number') return new Complex(val, 0);
    return new Complex(0, 0);
  }

  add(other) {
    const o = Complex.from(other);
    return new Complex(this.re + o.re, this.im + o.im);
  }

  sub(other) {
    const o = Complex.from(other);
    return new Complex(this.re - o.re, this.im - o.im);
  }

  mul(other) {
    const o = Complex.from(other);
    return new Complex(
      this.re * o.re - this.im * o.im,
      this.re * o.im + this.im * o.re
    );
  }

  div(other) {
    const o = Complex.from(other);
    const denom = o.re * o.re + o.im * o.im;
    if (denom === 0) throw new Error("División compleja por cero");
    return new Complex(
      (this.re * o.re + this.im * o.im) / denom,
      (this.im * o.re - this.re * o.im) / denom
    );
  }

  conj() {
    return new Complex(this.re, -this.im);
  }

  abs() {
    return Math.hypot(this.re, this.im);
  }

  absSq() {
    return this.re * this.re + this.im * this.im;
  }

  static exp(angle) {
    return new Complex(Math.cos(angle), Math.sin(angle));
  }
}

class QuantumMath {
  // Common 1-Qubit Quantum Gates Matrices 2x2
  static GATES = {
    I: [
      [new Complex(1, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(1, 0)]
    ],
    X: [
      [new Complex(0, 0), new Complex(1, 0)],
      [new Complex(1, 0), new Complex(0, 0)]
    ],
    Y: [
      [new Complex(0, 0), new Complex(0, -1)],
      [new Complex(0, 1), new Complex(0, 0)]
    ],
    Z: [
      [new Complex(1, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(-1, 0)]
    ],
    H: [
      [new Complex(1 / Math.SQRT2, 0), new Complex(1 / Math.SQRT2, 0)],
      [new Complex(1 / Math.SQRT2, 0), new Complex(-1 / Math.SQRT2, 0)]
    ],
    S: [
      [new Complex(1, 0), new Complex(0, 0)],
      [new Complex(0, 0), new Complex(0, 1)]
    ],
    T: [
      [new Complex(1, 0), new Complex(0, 0)],
      [new Complex(0, 0), Complex.exp(Math.PI / 4)]
    ],
    SX: [ // Sqrt(X)
      [new Complex(0.5, 0.5), new Complex(0.5, -0.5)],
      [new Complex(0.5, -0.5), new Complex(0.5, 0.5)]
    ]
  };

  /**
   * Generates Rz(theta) matrix
   */
  static Rz(theta) {
    const half = theta / 2;
    return [
      [Complex.exp(-half), new Complex(0, 0)],
      [new Complex(0, 0), Complex.exp(half)]
    ];
  }

  /**
   * Generates Rx(theta) matrix
   */
  static Rx(theta) {
    const half = theta / 2;
    const c = Math.cos(half);
    const s = Math.sin(half);
    return [
      [new Complex(c, 0), new Complex(0, -s)],
      [new Complex(0, -s), new Complex(c, 0)]
    ];
  }

  /**
   * Producto tensorial Kronecker entre dos matrices complejas
   */
  static tensorProduct(A, B) {
    const rA = A.length, cA = A[0].length;
    const rB = B.length, cB = B[0].length;
    const res = Array.from({ length: rA * rB }, () => Array(cA * cB));

    for (let i = 0; i < rA; i++) {
      for (let j = 0; j < cA; j++) {
        for (let k = 0; k < rB; k++) {
          for (let l = 0; l < cB; l++) {
            res[i * rB + k][j * cB + l] = A[i][j].mul(B[k][l]);
          }
        }
      }
    }
    return res;
  }

  /**
   * Producto de matrices cuadradas complejas
   */
  static matMul(A, B) {
    const n = A.length;
    const res = Array.from({ length: n }, () => Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = new Complex(0, 0);
        for (let k = 0; k < n; k++) {
          sum = sum.add(A[i][k].mul(B[k][j]));
        }
        res[i][j] = sum;
      }
    }
    return res;
  }

  /**
   * Matriz identidad de dimensión N
   */
  static identity(dim) {
    const I = Array.from({ length: dim }, () => Array(dim));
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        I[i][j] = (i === j) ? new Complex(1, 0) : new Complex(0, 0);
      }
    }
    return I;
  }

  /**
   * Simula vector de estado cuántico (statevector) para N qubits (hasta 8 en frontend)
   */
  static simulateCircuit(numQubits, instructions) {
    const dim = 1 << numQubits;
    let state = Array.from({ length: dim }, (_, i) => i === 0 ? new Complex(1, 0) : new Complex(0, 0));

    for (const inst of instructions) {
      state = QuantumMath.applyInstruction(numQubits, state, inst);
    }

    // Calcula probabilidades
    const probabilities = state.map(amp => amp.absSq());
    return { state, probabilities };
  }

  static applyInstruction(numQubits, state, inst) {
    const name = inst.name.toLowerCase();
    const targets = inst.targets;

    if (targets.length === 1) {
      const q = targets[0];
      let gateMat;
      if (name === 'h') gateMat = QuantumMath.GATES.H;
      else if (name === 'x') gateMat = QuantumMath.GATES.X;
      else if (name === 'y') gateMat = QuantumMath.GATES.Y;
      else if (name === 'z') gateMat = QuantumMath.GATES.Z;
      else if (name === 's') gateMat = QuantumMath.GATES.S;
      else if (name === 't') gateMat = QuantumMath.GATES.T;
      else if (name === 'sx') gateMat = QuantumMath.GATES.SX;
      else if (name === 'rz') gateMat = QuantumMath.Rz(inst.params?.[0] || 0);
      else if (name === 'rx') gateMat = QuantumMath.Rx(inst.params?.[0] || 0);
      else return state; // ignore unknown 1-qubit gate

      const nextState = new Array(state.length);
      const mask = 1 << (numQubits - 1 - q);

      for (let i = 0; i < state.length; i++) {
        if ((i & mask) === 0) {
          const i0 = i;
          const i1 = i | mask;
          const a0 = state[i0];
          const a1 = state[i1];

          nextState[i0] = gateMat[0][0].mul(a0).add(gateMat[0][1].mul(a1));
          nextState[i1] = gateMat[1][0].mul(a0).add(gateMat[1][1].mul(a1));
        }
      }
      return nextState;
    } else if (targets.length === 2) {
      const [ctrl, tgt] = targets;
      const maskC = 1 << (numQubits - 1 - ctrl);
      const maskT = 1 << (numQubits - 1 - tgt);
      const nextState = [...state];

      if (name === 'cx' || name === 'cnot') {
        for (let i = 0; i < state.length; i++) {
          if ((i & maskC) !== 0 && (i & maskT) === 0) {
            const i1 = i | maskT;
            const temp = nextState[i];
            nextState[i] = nextState[i1];
            nextState[i1] = temp;
          }
        }
      } else if (name === 'swap') {
        for (let i = 0; i < state.length; i++) {
          const bitC = (i & maskC) !== 0;
          const bitT = (i & maskT) !== 0;
          if (bitC !== bitT && !bitC) {
            const j = (i | maskC) & (~maskT);
            const temp = nextState[i];
            nextState[i] = nextState[j];
            nextState[j] = temp;
          }
        }
      } else if (name === 'cz') {
        for (let i = 0; i < state.length; i++) {
          if ((i & maskC) !== 0 && (i & maskT) !== 0) {
            nextState[i] = nextState[i].mul(new Complex(-1, 0));
          }
        }
      }
      return nextState;
    }
    return state;
  }
}

// Exportación global en navegador
window.Complex = Complex;
window.QuantumMath = QuantumMath;
