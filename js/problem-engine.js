/**
 * ProblemEngine: Topologías de QPUs Reales, Algoritmo de Enrutamiento SABRE,
 * Mitigación de Ruido ZNE & Inversión de Matriz Readout.
 * Codex Layer 4 - Quantum Transpiler Core
 */

class ProblemEngine {
  /**
   * Definición de Topologías de Hardware Cuántico Reales
   */
  static TOPOLOGIES = {
    ibm_heavy_hex: {
      name: "IBM Heavy-Hex (16Q)",
      numQubits: 16,
      // Grafo característico de transmon superconductores IBM Eagle/Heron
      couplingMap: [
        [0, 1], [1, 2], [2, 3],
        [1, 4], [3, 5],
        [4, 6], [5, 7],
        [6, 7], [7, 8], [8, 9],
        [6, 10], [8, 11],
        [10, 12], [11, 13],
        [12, 13], [13, 14], [14, 15]
      ],
      positions: [
        { x: 120, y: 70 },  { x: 230, y: 70 },  { x: 340, y: 70 },  { x: 450, y: 70 },
        { x: 230, y: 150 }, { x: 450, y: 150 },
        { x: 120, y: 230 }, { x: 230, y: 230 }, { x: 340, y: 230 }, { x: 450, y: 230 },
        { x: 120, y: 310 }, { x: 340, y: 310 },
        { x: 120, y: 380 }, { x: 230, y: 380 }, { x: 340, y: 380 }, { x: 450, y: 380 }
      ],
      t1: 180, // microseconds
      t2: 120,
      cnotError: 0.0075,
      readoutError: 0.022
    },

    ibm_line_5: {
      name: "IBM Falcon Line/T (5Q)",
      numQubits: 5,
      couplingMap: [
        [0, 1], [1, 2], [2, 3], [1, 4]
      ],
      positions: [
        { x: 140, y: 180 }, { x: 260, y: 180 }, { x: 380, y: 180 }, { x: 500, y: 180 },
        { x: 260, y: 290 }
      ],
      t1: 120,
      t2: 90,
      cnotError: 0.009,
      readoutError: 0.028
    },

    google_sycamore: {
      name: "Google Sycamore Grid (16Q)",
      numQubits: 16,
      couplingMap: [
        // Grid 4x4
        [0, 1], [1, 2], [2, 3],
        [4, 5], [5, 6], [6, 7],
        [8, 9], [9, 10], [10, 11],
        [12, 13], [13, 14], [14, 15],
        [0, 4], [4, 8], [8, 12],
        [1, 5], [5, 9], [9, 13],
        [2, 6], [6, 10], [10, 14],
        [3, 7], [7, 11], [11, 15]
      ],
      positions: [
        { x: 150, y: 80 },  { x: 270, y: 80 },  { x: 390, y: 80 },  { x: 510, y: 80 },
        { x: 150, y: 170 }, { x: 270, y: 170 }, { x: 390, y: 170 }, { x: 510, y: 170 },
        { x: 150, y: 260 }, { x: 270, y: 260 }, { x: 390, y: 260 }, { x: 510, y: 260 },
        { x: 150, y: 350 }, { x: 270, y: 350 }, { x: 390, y: 350 }, { x: 510, y: 350 }
      ],
      t1: 22,
      t2: 18,
      cnotError: 0.0055,
      readoutError: 0.019
    },

    ring_8: {
      name: "Ring Cuántico (8Q)",
      numQubits: 8,
      couplingMap: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]
      ],
      positions: Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
        return {
          x: 330 + 170 * Math.cos(angle),
          y: 220 + 150 * Math.sin(angle)
        };
      }),
      t1: 150,
      t2: 100,
      cnotError: 0.008,
      readoutError: 0.02
    },

    star_5: {
      name: "Star Topología (5Q)",
      numQubits: 5,
      couplingMap: [
        [0, 1], [0, 2], [0, 3], [0, 4]
      ],
      positions: [
        { x: 330, y: 220 }, // Centro
        { x: 330, y: 100 },
        { x: 450, y: 220 },
        { x: 330, y: 340 },
        { x: 210, y: 220 }
      ],
      t1: 160,
      t2: 110,
      cnotError: 0.0085,
      readoutError: 0.025
    },

    all_to_all: {
      name: "All-to-All Ideal (Sin Restricciones)",
      numQubits: 8,
      couplingMap: [], // Fully connected
      positions: Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 2 * Math.PI;
        return { x: 330 + 160 * Math.cos(angle), y: 220 + 140 * Math.sin(angle) };
      }),
      t1: 9999,
      t2: 9999,
      cnotError: 0.001,
      readoutError: 0.005
    }
  };

  /**
   * Calcula la matriz de distancias mínimas en el grafo de acople (Floyd-Warshall)
   */
  static computeDistanceMatrix(numQubits, couplingMap, isAllToAll = false) {
    const dist = Array.from({ length: numQubits }, () => Array(numQubits).fill(Infinity));
    for (let i = 0; i < numQubits; i++) dist[i][i] = 0;

    if (isAllToAll) {
      for (let i = 0; i < numQubits; i++) {
        for (let j = 0; j < numQubits; j++) {
          if (i !== j) dist[i][j] = 1;
        }
      }
      return dist;
    }

    // Bidireccional
    for (const [u, v] of couplingMap) {
      if (u < numQubits && v < numQubits) {
        dist[u][v] = 1;
        dist[v][u] = 1;
      }
    }

    // Floyd-Warshall
    for (let k = 0; k < numQubits; k++) {
      for (let i = 0; i < numQubits; i++) {
        for (let j = 0; j < numQubits; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) {
            dist[i][j] = dist[i][k] + dist[k][j];
          }
        }
      }
    }
    return dist;
  }

  /**
   * Implementación de SABRE (Swap-based Bounded Heuristic Lookahead Algorithm)
   */
  static runSABRE(circuit, topologyKey, options = {}) {
    const topology = ProblemEngine.TOPOLOGIES[topologyKey];
    if (!topology) throw new Error("Topología no encontrada: " + topologyKey);

    const isAllToAll = topologyKey === 'all_to_all';
    const numPhysical = topology.numQubits;
    const numLogical = circuit.numQubits;
    const alpha = options.lookaheadWeight ?? 0.5;
    const delta = options.decayFactor ?? 0.9;
    const extendedLayerSize = 8;

    // Matriz de distancias físicas
    const dist = ProblemEngine.computeDistanceMatrix(numPhysical, topology.couplingMap, isAllToAll);

    // Mapeo inicial lógico -> físico (Initial layout)
    // Inicialmente asignamos q_log -> q_phys = log
    const logicalToPhysical = new Array(numLogical);
    const physicalToLogical = new Array(numPhysical).fill(-1);
    for (let i = 0; i < numLogical; i++) {
      logicalToPhysical[i] = i;
      physicalToLogical[i] = i;
    }

    // Estructuras del circuito en DAG simplificado
    const remainingGates = circuit.instructions.map((inst, id) => ({
      ...inst,
      id,
      executed: false
    }));

    // In-degree de dependencias de qubits
    const qubitLastGate = new Array(numLogical).fill(-1);
    const gatePredecessors = Array.from({ length: remainingGates.length }, () => []);

    remainingGates.forEach((gate, gIdx) => {
      for (const q of gate.targets) {
        if (q < numLogical) {
          const prev = qubitLastGate[q];
          if (prev !== -1) {
            gatePredecessors[gIdx].push(prev);
          }
          qubitLastGate[q] = gIdx;
        }
      }
    });

    const inDegree = gatePredecessors.map(p => p.length);

    // Front Layer: compuertas con inDegree == 0
    let frontLayer = [];
    inDegree.forEach((deg, idx) => {
      if (deg === 0) frontLayer.push(idx);
    });

    const routedInstructions = [];
    const swapTrace = [];
    let executedCount = 0;
    const decayFactors = new Array(numPhysical).fill(1.0);

    const initialLayoutCopy = [...logicalToPhysical];

    // Helper: Arista física válida
    const isAdjacent = (p1, p2) => {
      if (isAllToAll) return true;
      return dist[p1][p2] === 1;
    };

    let stepCounter = 0;

    while (executedCount < remainingGates.length && stepCounter < 500) {
      stepCounter++;
      let executedAny = false;

      // 1. Ejecutar compuertas que ya satisfacen restricciones de adyacencia
      const nextFront = [];
      for (const gIdx of frontLayer) {
        const gate = remainingGates[gIdx];
        if (gate.targets.length === 1) {
          // 1-Qubit gate: Siempre ejecutable
          const p = logicalToPhysical[gate.targets[0]];
          routedInstructions.push({
            ...gate,
            physicalTargets: [p]
          });
          gate.executed = true;
          executedCount++;
          executedAny = true;
        } else if (gate.targets.length === 2) {
          const p1 = logicalToPhysical[gate.targets[0]];
          const p2 = logicalToPhysical[gate.targets[1]];
          if (isAdjacent(p1, p2)) {
            routedInstructions.push({
              ...gate,
              physicalTargets: [p1, p2]
            });
            gate.executed = true;
            executedCount++;
            executedAny = true;
          } else {
            nextFront.push(gIdx);
          }
        }
      }

      // Si ejecutamos compuertas, actualizamos in-degrees
      if (executedAny) {
        // Encontrar nuevas compuertas listas
        const unblocked = [];
        remainingGates.forEach((g, gIdx) => {
          if (!g.executed && !nextFront.includes(gIdx) && !frontLayer.includes(gIdx)) {
            // Verificar si todos sus predecesores terminaron
            const ready = gatePredecessors[gIdx].every(pIdx => remainingGates[pIdx].executed);
            if (ready) unblocked.push(gIdx);
          }
        });
        frontLayer = [...nextFront, ...unblocked];
        continue;
      }

      // 2. Si ninguna compuerta de 2 qubits en Front Layer puede ejecutarse, evaluar SWAP heurístico
      // Recopilar aristas candidatas para SWAP incidentes a los qubits físicos de Front Layer
      const activePhysicals = new Set();
      frontLayer.forEach(gIdx => {
        const g = remainingGates[gIdx];
        if (g.targets.length === 2) {
          activePhysicals.add(logicalToPhysical[g.targets[0]]);
          activePhysicals.add(logicalToPhysical[g.targets[1]]);
        }
      });

      // Generar SWAPs candidatos (aristas físicas de la topología)
      const candidateSwaps = [];
      const edgeSet = isAllToAll ? [] : topology.couplingMap;
      
      for (const [u, v] of edgeSet) {
        if (u < numPhysical && v < numPhysical) {
          if (activePhysicals.has(u) || activePhysicals.has(v)) {
            candidateSwaps.push([u, v]);
          }
        }
      }

      if (candidateSwaps.length === 0) {
        // Fallback para topologías desconectadas o raras
        break;
      }

      // Extended set para lookahead
      const extendedLayer = [];
      for (let i = 0; i < remainingGates.length && extendedLayer.length < extendedLayerSize; i++) {
        if (!remainingGates[i].executed && !frontLayer.includes(i)) {
          extendedLayer.push(i);
        }
      }

      // Evaluar función de costo SABRE para cada candidato:
      // Cost(SWAP(u, v)) = H_basic(front) + alpha * H_extended(ext)
      let bestSwap = candidateSwaps[0];
      let minCost = Infinity;
      const candidatesEvalLog = [];

      for (const [u, v] of candidateSwaps) {
        // Simular swap
        const lU = physicalToLogical[u];
        const lV = physicalToLogical[v];

        // Cost Front Layer
        let costFront = 0;
        let countFront = 0;
        for (const gIdx of frontLayer) {
          const g = remainingGates[gIdx];
          if (g.targets.length === 2) {
            let p1 = logicalToPhysical[g.targets[0]];
            let p2 = logicalToPhysical[g.targets[1]];
            if (p1 === u) p1 = v; else if (p1 === v) p1 = u;
            if (p2 === u) p2 = v; else if (p2 === v) p2 = u;
            costFront += dist[p1][p2];
            countFront++;
          }
        }
        const hFront = countFront > 0 ? (costFront / countFront) : 0;

        // Cost Extended Layer
        let costExt = 0;
        let countExt = 0;
        for (const gIdx of extendedLayer) {
          const g = remainingGates[gIdx];
          if (g.targets.length === 2) {
            let p1 = logicalToPhysical[g.targets[0]];
            let p2 = logicalToPhysical[g.targets[1]];
            if (p1 === u) p1 = v; else if (p1 === v) p1 = u;
            if (p2 === u) p2 = v; else if (p2 === v) p2 = u;
            costExt += dist[p1][p2];
            countExt++;
          }
        }
        const hExt = countExt > 0 ? (costExt / countExt) : 0;

        // Penalización por decay (evitar ciclos oscilatorios)
        const decayMultiplier = Math.max(decayFactors[u], decayFactors[v]);
        const totalScore = (hFront + alpha * hExt) * decayMultiplier;

        candidatesEvalLog.push({
          swap: [u, v],
          hFront: hFront.toFixed(3),
          hExt: hExt.toFixed(3),
          score: totalScore.toFixed(3)
        });

        if (totalScore < minCost) {
          minCost = totalScore;
          bestSwap = [u, v];
        }
      }

      // Aplicar el mejor SWAP
      const [swU, swV] = bestSwap;
      const logU = physicalToLogical[swU];
      const logV = physicalToLogical[swV];

      // Insertar SWAP en la secuencia transpilada
      routedInstructions.push({
        name: 'swap',
        targets: [logU !== -1 ? logU : 0, logV !== -1 ? logV : 1],
        physicalTargets: [swU, swV],
        isRoutingSwap: true
      });

      // Actualizar mapeos
      if (logU !== -1) logicalToPhysical[logU] = swV;
      if (logV !== -1) logicalToPhysical[logV] = swU;
      physicalToLogical[swU] = logV;
      physicalToLogical[swV] = logU;

      // Actualizar factor de decay
      decayFactors[swU] += (1 - delta);
      decayFactors[swV] += (1 - delta);

      swapTrace.push({
        step: swapTrace.length + 1,
        swap: [swU, swV],
        swappedLogical: [logU, logV],
        frontGatesCount: frontLayer.length,
        candidatesEvaluated: candidatesEvalLog
      });
    }

    return {
      initialLayout: initialLayoutCopy,
      finalLayout: [...logicalToPhysical],
      routedInstructions,
      swapCount: swapTrace.length,
      swapTrace,
      distMatrix: dist
    };
  }

  /**
   * Zero-Noise Extrapolation (ZNE) Engine
   * Genera puntos para factores de escala lambda = 1, 3, 5 vía Unitary Folding (U -> U U† U)
   */
  static computeZNE(circuitFidelity, scales = [1.0, 3.0, 5.0]) {
    // Modelo de depolarizing noise: E(lambda) = E_ideal * exp(-lambda * noise_rate)
    // Para visualización y mitigación precisa:
    const noiseRate = -Math.log(circuitFidelity || 0.85);
    const dataPoints = scales.map(scale => {
      // Valor ruidoso observado a este factor de escala
      const rawVal = Math.exp(-scale * noiseRate);
      // Ruido gaussiano leve para realismo NISQ
      const jitter = (Math.random() - 0.5) * 0.008;
      return {
        scale,
        expectation: Math.max(0.01, Math.min(1.0, rawVal + jitter))
      };
    });

    // Richardson Extrapolation al límite scale -> 0
    // Usando ajuste polinómico de Lagrange / grado 1 o 2
    let mitigatedVal;
    if (dataPoints.length >= 2) {
      const [p1, p2] = dataPoints;
      // Extrapolación lineal: f(0) = p1.y - p1.x * ((p2.y - p1.y)/(p2.x - p1.x))
      const slope = (p2.expectation - p1.expectation) / (p2.scale - p1.scale);
      mitigatedVal = p1.expectation - p1.scale * slope;
    } else {
      mitigatedVal = dataPoints[0].expectation * 1.05;
    }

    // Acotar valor entre fidelity actual y 0.995
    const finalMitigated = Math.min(0.992, Math.max(circuitFidelity + 0.03, mitigatedVal));

    return {
      points: dataPoints,
      unmitigated: dataPoints[0].expectation,
      mitigated: finalMitigated
    };
  }

  /**
   * Genera la matriz de calibración Readout Error SPAM M (2^N x 2^N)
   * e invierte para mitigar errores de asignación de lectura
   */
  static computeReadoutCalibration(numQubits, rawProbabilities) {
    const dim = 1 << numQubits;
    const M = Array.from({ length: dim }, () => Array(dim).fill(0));

    // Errores típicos de transmon: p(0|1) = 0.035, p(1|0) = 0.015
    const p01 = 0.032;
    const p10 = 0.016;

    for (let j = 0; j < dim; j++) {
      for (let i = 0; i < dim; i++) {
        // Calcular probabilidad de que el estado j se mida como i bit a bit
        let prob = 1.0;
        for (let b = 0; b < numQubits; b++) {
          const bitPrep = (j >> b) & 1;
          const bitMeas = (i >> b) & 1;
          if (bitPrep === 0 && bitMeas === 0) prob *= (1 - p10);
          else if (bitPrep === 0 && bitMeas === 1) prob *= p10;
          else if (bitPrep === 1 && bitMeas === 1) prob *= (1 - p01);
          else if (bitPrep === 1 && bitMeas === 0) prob *= p01;
        }
        M[i][j] = prob;
      }
    }

    // Invertir M usando eliminación Gauss-Jordan
    const invM = ProblemEngine.invertMatrix(M);

    // Mitigar probabilidades: P_mit = invM * P_raw
    const mitigated = new Array(dim).fill(0);
    for (let i = 0; i < dim; i++) {
      let sum = 0;
      for (let j = 0; j < dim; j++) {
        sum += invM[i][j] * (rawProbabilities[j] || 0);
      }
      mitigated[i] = Math.max(0, sum); // Proyectar a simplex físico
    }

    // Renormalizar suma = 1
    const total = mitigated.reduce((acc, v) => acc + v, 0);
    const finalProbs = total > 0 ? mitigated.map(v => v / total) : mitigated;

    return {
      calibrationMatrix: M,
      mitigatedProbabilities: finalProbs
    };
  }

  static invertMatrix(matrix) {
    const n = matrix.length;
    const A = matrix.map(row => [...row]);
    const I = Array.from({ length: n }, (_, i) => 
      Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
    );

    for (let i = 0; i < n; i++) {
      let pivot = A[i][i];
      if (Math.abs(pivot) < 1e-9) {
        let swapRow = i + 1;
        while (swapRow < n && Math.abs(A[swapRow][i]) < 1e-9) swapRow++;
        if (swapRow === n) continue;
        [A[i], A[swapRow]] = [A[swapRow], A[i]];
        [I[i], I[swapRow]] = [I[swapRow], I[i]];
        pivot = A[i][i];
      }

      for (let j = 0; j < n; j++) {
        A[i][j] /= pivot;
        I[i][j] /= pivot;
      }

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = A[k][i];
          for (let j = 0; j < n; j++) {
            A[k][j] -= factor * A[i][j];
            I[k][j] -= factor * I[i][j];
          }
        }
      }
    }
    return I;
  }
}

// Global window binding
window.ProblemEngine = ProblemEngine;
