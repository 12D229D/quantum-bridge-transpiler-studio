/**
 * QasmBridge: Parser de OpenQASM 2.0 / 3.0, Descomponedor a Conjuntos de Puertas Nativas
 * (IBM Transmon, Google Sycamore, Rigetti Ankaa, IonQ) y Generador de Código Transpilado.
 * Codex Layer 4 - Quantum Transpiler Core
 */

class QasmBridge {
  /**
   * Parsea código OpenQASM 2.0 o 3.0 estándar
   */
  static parse(qasmText) {
    const lines = qasmText.split('\n');
    let numQubits = 4;
    const instructions = [];

    for (let rawLine of lines) {
      let line = rawLine.trim();
      // Eliminar comentarios //
      const commentIdx = line.indexOf('//');
      if (commentIdx !== -1) line = line.substring(0, commentIdx).trim();
      if (!line) continue;

      // Declaración de qubits: qubit[4] q; o qreg q[4];
      const qubitDeclMatch = line.match(/(?:qubit\[(\d+)\]|qreg\s+\w+\[(\d+)\])/i);
      if (qubitDeclMatch) {
        numQubits = parseInt(qubitDeclMatch[1] || qubitDeclMatch[2], 10);
        continue;
      }

      // Ignorar cabeceras y mediciones para el grafo
      if (line.startsWith('OPENQASM') || line.startsWith('include') || line.startsWith('bit[') || line.startsWith('creg')) {
        continue;
      }

      if (line.includes('measure') || line.startsWith('barrier')) {
        continue;
      }

      // Remover punto y coma
      if (line.endsWith(';')) line = line.slice(0, -1).trim();

      // Parsear compuertas con o sin parámetros
      // ej: cx q[0], q[1]  |  rz(0.785) q[2]  |  h q[0]
      const gateMatch = line.match(/^([a-zA-Z_]+)(?:\(([^)]+)\))?\s+(.+)$/);
      if (gateMatch) {
        const name = gateMatch[1].toLowerCase();
        const paramStr = gateMatch[2];
        const argsStr = gateMatch[3];

        const params = paramStr ? paramStr.split(',').map(s => {
          try {
            // Evaluar expresiones matemáticas simples como pi/2
            const expr = s.replace(/pi/g, Math.PI.toString());
            return parseFloat(Function(`'use strict'; return (${expr})`)());
          } catch (e) {
            return parseFloat(s) || 0;
          }
        }) : [];

        // Extraer índices de qubits de argsStr (ej: q[0], q[1] o 0, 1)
        const targets = [];
        const qMatches = argsStr.matchAll(/\[(\d+)\]|(?:\b(\d+)\b)/g);
        for (const m of qMatches) {
          const idx = parseInt(m[1] !== undefined ? m[1] : m[2], 10);
          if (!isNaN(idx)) targets.push(idx);
        }

        if (targets.length > 0) {
          instructions.push({
            name,
            params,
            targets,
            raw: line
          });
        }
      }
    }

    return {
      numQubits: Math.max(numQubits, 1),
      instructions
    };
  }

  /**
   * Descompone una compuerta arbitraria a un conjunto nativo de hardware
   */
  static decomposeInstruction(inst, basisSet = 'ibm_basis') {
    const name = inst.name.toLowerCase();
    const targets = inst.physicalTargets || inst.targets;

    if (basisSet === 'ibm_basis') {
      // Nativo: {sx, x, rz, cx}
      if (name === 'h') {
        // H = Rz(pi/2) -> SX -> Rz(pi/2)
        const q = targets[0];
        return [
          { name: 'rz', params: [Math.PI / 2], targets: [q] },
          { name: 'sx', params: [], targets: [q] },
          { name: 'rz', params: [Math.PI / 2], targets: [q] }
        ];
      }
      if (name === 's') {
        return [{ name: 'rz', params: [Math.PI / 2], targets: [targets[0]] }];
      }
      if (name === 't') {
        return [{ name: 'rz', params: [Math.PI / 4], targets: [targets[0]] }];
      }
      if (name === 'y') {
        // Y = Rz(pi) -> X
        return [
          { name: 'rz', params: [Math.PI], targets: [targets[0]] },
          { name: 'x', params: [], targets: [targets[0]] }
        ];
      }
      if (name === 'z') {
        return [{ name: 'rz', params: [Math.PI], targets: [targets[0]] }];
      }
      if (name === 'swap') {
        // SWAP = 3 CX alternados
        const [c, t] = targets;
        return [
          { name: 'cx', params: [], targets: [c, t] },
          { name: 'cx', params: [], targets: [t, c] },
          { name: 'cx', params: [], targets: [c, t] }
        ];
      }
      if (name === 'cz') {
        // CZ = H(t) -> CX -> H(t)
        const [c, t] = targets;
        return [
          { name: 'rz', params: [Math.PI / 2], targets: [t] },
          { name: 'sx', params: [], targets: [t] },
          { name: 'rz', params: [Math.PI / 2], targets: [t] },
          { name: 'cx', params: [], targets: [c, t] },
          { name: 'rz', params: [Math.PI / 2], targets: [t] },
          { name: 'sx', params: [], targets: [t] },
          { name: 'rz', params: [Math.PI / 2], targets: [t] }
        ];
      }
      // sx, x, rz, cx son nativas directas
      return [{ ...inst, targets }];
    }

    if (basisSet === 'google_basis') {
      // Nativo: {PhasedXZ, fSim, cz}
      if (name === 'cx' || name === 'cnot') {
        // CX = sycamore decomposition
        const [c, t] = targets;
        return [
          { name: 'phased_xz', params: [0, Math.PI / 2, -Math.PI / 2], targets: [t] },
          { name: 'cz', params: [], targets: [c, t] },
          { name: 'phased_xz', params: [0, Math.PI / 2, Math.PI / 2], targets: [t] }
        ];
      }
      if (name === 'swap') {
        const [c, t] = targets;
        // 3 CZ con Hadamard o 1 fSim(pi/2, pi/6)
        return [
          { name: 'fsim', params: [Math.PI / 2, 0], targets: [c, t] }
        ];
      }
      return [{ ...inst, targets }];
    }

    if (basisSet === 'rigetti_basis') {
      // Nativo: {rx, rz, cz}
      if (name === 'cx' || name === 'cnot') {
        const [c, t] = targets;
        return [
          { name: 'rx', params: [Math.PI / 2], targets: [t] },
          { name: 'cz', params: [], targets: [c, t] },
          { name: 'rx', params: [-Math.PI / 2], targets: [t] }
        ];
      }
      if (name === 'h') {
        const q = targets[0];
        return [
          { name: 'rz', params: [Math.PI / 2], targets: [q] },
          { name: 'rx', params: [Math.PI / 2], targets: [q] },
          { name: 'rz', params: [Math.PI / 2], targets: [q] }
        ];
      }
      return [{ ...inst, targets }];
    }

    // Default
    return [{ ...inst, targets }];
  }

  /**
   * Genera el archivo OpenQASM 3.0 transpilado completo
   */
  static generateTranspiledQASM(numPhysicalQubits, finalInstructions, basisSet, qpuName) {
    let out = `// ===================================================================\n`;
    out += `// OPENQASM 3.0 TRANSPILADO - CODEX QUANTUM BRIDGE STUDIO\n`;
    out += `// Arquitectura Destino: ${qpuName}\n`;
    out += `// Conjunto de Puertas Nativo: ${basisSet}\n`;
    out += `// Enrutamiento SABRE con Mapeo de Conectividad Estricto\n`;
    out += `// Generado: ${new Date().toISOString()}\n`;
    out += `// ===================================================================\n\n`;
    out += `OPENQASM 3.0;\n`;
    out += `include "stdgates.inc";\n\n`;
    out += `// Registros de Qubits Físicos en QPU\n`;
    out += `qubit[${numPhysicalQubits}] q;\n`;
    out += `bit[${numPhysicalQubits}] c;\n\n`;

    for (const inst of finalInstructions) {
      const name = inst.name;
      const targets = (inst.physicalTargets || inst.targets).map(t => `q[${t}]`).join(', ');
      if (inst.params && inst.params.length > 0) {
        const pStr = inst.params.map(p => p.toFixed(6)).join(', ');
        out += `${name}(${pStr}) ${targets};\n`;
      } else {
        out += `${name} ${targets};\n`;
      }
    }

    out += `\n// Barrera de sincronización y medición final\n`;
    out += `barrier q;\n`;
    out += `c = measure q;\n`;

    return out;
  }

  /**
   * Genera script ejecutable en Python / Qiskit 1.x
   */
  static generateQiskitScript(numPhysicalQubits, finalInstructions, qpuName) {
    return `# ===================================================================
# Qiskit 1.x Execution Script - Transpiled via Quantum Bridge Studio
# Backend: ${qpuName}
# ===================================================================

from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler

qr = QuantumRegister(${numPhysicalQubits}, 'q')
cr = ClassicalRegister(${numPhysicalQubits}, 'c')
qc = QuantumCircuit(qr, cr, name="transpiled_quantum_bridge")

${finalInstructions.map(inst => {
  const t = inst.physicalTargets || inst.targets;
  if (inst.name === 'cx') return `qc.cx(qr[${t[0]}], qr[${t[1]}])`;
  if (inst.name === 'swap') return `qc.swap(qr[${t[0]}], qr[${t[1]}])`;
  if (inst.name === 'cz') return `qc.cz(qr[${t[0]}], qr[${t[1]}])`;
  if (inst.name === 'rz') return `qc.rz(${(inst.params?.[0]||0).toFixed(5)}, qr[${t[0]}])`;
  if (inst.name === 'rx') return `qc.rx(${(inst.params?.[0]||0).toFixed(5)}, qr[${t[0]}])`;
  if (inst.name === 'sx') return `qc.sx(qr[${t[0]}])`;
  if (inst.name === 'x') return `qc.x(qr[${t[0]}])`;
  if (inst.name === 'h') return `qc.h(qr[${t[0]}])`;
  return `# Unsupported instruction: ${inst.name}`;
}).join('\n')}

qc.barrier()
qc.measure(qr, cr)

print("Circuito transpilado construido exitosamente.")
print(f"Profundidad: {qc.depth()} | Cuenta CNOT: {qc.count_ops().get('cx', 0)}")
`;
  }
}

// Global window binding
window.QasmBridge = QasmBridge;
