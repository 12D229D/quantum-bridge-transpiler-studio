/**
 * App.js: Controlador Principal del Quantum Bridge Transpiler Studio.
 * Enrutamiento reactivo, renderizado de grafos topológicos interactivos en Canvas,
 * diagramas de circuitos SVG, reproductor heurístico SABRE y gráficas ZNE.
 * Codex Layer 4 - Quantum Transpiler Core
 */

(function () {
  'use strict';

  // Preset Circuits Library
  const PRESET_CIRCUITS = {
    ghz_4: `// 4-Qubit GHZ State (Greenberger-Horne-Zeilinger)
OPENQASM 3.0;
include "stdgates.inc";

qubit[4] q;
bit[4] c;

h q[0];
cx q[0], q[1];
cx q[1], q[2];
cx q[2], q[3];
c = measure q;`,

    qft_3: `// 3-Qubit Quantum Fourier Transform (QFT)
OPENQASM 3.0;
include "stdgates.inc";

qubit[3] q;
bit[3] c;

h q[0];
rz(1.57079) q[1];
cx q[0], q[1];
h q[1];
rz(0.78539) q[2];
cx q[0], q[2];
cx q[1], q[2];
h q[2];
swap q[0], q[2];
c = measure q;`,

    adder_4: `// 4-Qubit Ripple Carry Quantum Adder
OPENQASM 3.0;
include "stdgates.inc";

qubit[4] q;
bit[4] c;

x q[0];
x q[1];
cx q[0], q[1];
cx q[1], q[2];
h q[3];
cx q[2], q[3];
rz(0.785398) q[3];
cx q[1], q[3];
h q[3];
c = measure q;`,

    bell_cross: `// Cross-Talk Stress Test (Long Distance CNOTs)
OPENQASM 3.0;
include "stdgates.inc";

qubit[4] q;
bit[4] c;

h q[0];
h q[2];
// Enlaces no locales intencionales para forzar enrutamiento SWAP
cx q[0], q[3];
cx q[1], q[3];
cx q[0], q[2];
h q[3];
c = measure q;`,

    random_entangle: `// Entanglement Cluster Benchmark
OPENQASM 3.0;
include "stdgates.inc";

qubit[5] q;
bit[5] c;

h q[0];
h q[1];
h q[2];
cx q[0], q[3];
cx q[1], q[4];
rz(1.047) q[3];
cx q[2], q[4];
cx q[3], q[4];
h q[4];
c = measure q;`
  };

  // State Management
  const state = {
    qpuKey: 'ibm_heavy_hex',
    basisSet: 'ibm_basis',
    routerAlgorithm: 'sabre',
    lookaheadWeight: 0.5,
    decayFactor: 0.9,
    enableZne: true,
    enableRoem: true,
    parsedCircuit: null,
    sabreResult: null,
    transpiledInstructions: [],
    finalQasm: '',
    currentSabreStep: 0,
    isPlayingSabre: false,
    playInterval: null
  };

  // DOM Elements
  const elements = {
    selectQpu: document.getElementById('select-qpu-target'),
    selectBasis: document.getElementById('select-basis-gates'),
    selectPresets: document.getElementById('select-preset-circuits'),
    editorQasm: document.getElementById('editor-qasm-input'),
    btnParse: document.getElementById('btn-parse-circuit'),
    btnQuickRun: document.getElementById('btn-quick-run'),
    btnExportQasm: document.getElementById('btn-export-qasm'),
    selectRouter: document.getElementById('select-router-algorithm'),
    sliderLookahead: document.getElementById('input-lookahead-weight'),
    valLookahead: document.getElementById('val-lookahead-weight'),
    sliderDecay: document.getElementById('input-decay-rate'),
    valDecay: document.getElementById('val-decay-rate'),
    checkZne: document.getElementById('check-enable-zne'),
    checkRoem: document.getElementById('check-enable-roem'),
    sqliteCount: document.getElementById('sqlite-records-count'),
    btnSaveCache: document.getElementById('btn-save-cache'),
    btnClearCache: document.getElementById('btn-clear-cache'),
    canvasTopology: document.getElementById('canvas-topology'),
    qpuTooltip: document.getElementById('qpu-tooltip'),
    headerBackendLabel: document.getElementById('header-backend-label'),
    backendFamilyBadge: document.getElementById('backend-family-badge'),
    mappingChipsList: document.getElementById('mapping-chips-list'),
    renderOrig: document.getElementById('render-circuit-orig'),
    renderTrans: document.getElementById('render-circuit-trans'),
    kpiCnotBefore: document.getElementById('kpi-cnot-before'),
    kpiCnotAfter: document.getElementById('kpi-cnot-after'),
    kpiCnotDelta: document.getElementById('kpi-cnot-delta'),
    kpiDepthBefore: document.getElementById('kpi-depth-before'),
    kpiDepthAfter: document.getElementById('kpi-depth-after'),
    kpiDepthDelta: document.getElementById('kpi-depth-delta'),
    kpiFidelityVal: document.getElementById('kpi-fidelity-val'),
    kpiFidelityZne: document.getElementById('kpi-fidelity-zne'),
    kpiSwapsCount: document.getElementById('kpi-swaps-count'),
    kpiSwapsHardware: document.getElementById('kpi-swaps-hardware'),
    btnSabrePrev: document.getElementById('btn-sabre-prev'),
    btnSabreNext: document.getElementById('btn-sabre-next'),
    btnSabrePlay: document.getElementById('btn-sabre-play'),
    sabreStepCounter: document.getElementById('sabre-step-counter'),
    sabreFrontLayer: document.getElementById('sabre-front-layer'),
    sabreCandidatesTable: document.getElementById('sabre-candidates-table'),
    sabreLogTerminal: document.getElementById('sabre-log-terminal'),
    canvasZneCurve: document.getElementById('canvas-zne-curve'),
    znePointsTable: document.getElementById('zne-points-table'),
    readoutMatrixContainer: document.getElementById('readout-matrix-container'),
    histStateDist: document.getElementById('hist-state-distribution'),
    decompCardsContainer: document.getElementById('decomp-cards-container'),
    codeTranspiled: document.getElementById('code-transpiled-output'),
    btnCopyTranspiled: document.getElementById('btn-copy-transpiled'),
    btnDownloadQasm: document.getElementById('btn-download-qasm'),
    btnDownloadQiskitPy: document.getElementById('btn-download-qiskit-py'),
    footerMsg: document.getElementById('footer-system-msg'),
    inputStatsBadge: document.getElementById('input-stats-badge')
  };

  /**
   * Inicialización del Sistema
   */
  async function init() {
    setupEventListeners();
    setupTabSwitching();
    updateSqliteCounter();
    parseAndTranspile();
    showToast("Quantum Bridge Transpiler Studio inicializado con éxito.", "info");
  }

  function setupEventListeners() {
    // QPU Target selection
    elements.selectQpu.addEventListener('change', (e) => {
      state.qpuKey = e.target.value;
      const top = ProblemEngine.TOPOLOGIES[state.qpuKey];
      elements.headerBackendLabel.textContent = top ? top.name : state.qpuKey;
      elements.backendFamilyBadge.textContent = top ? top.name : state.qpuKey;
      parseAndTranspile();
    });

    // Basis gates selection
    elements.selectBasis.addEventListener('change', (e) => {
      state.basisSet = e.target.value;
      parseAndTranspile();
    });

    // Presets
    elements.selectPresets.addEventListener('change', (e) => {
      const code = PRESET_CIRCUITS[e.target.value];
      if (code) {
        elements.editorQasm.value = code;
        parseAndTranspile();
      }
    });

    // Sliders
    elements.sliderLookahead.addEventListener('input', (e) => {
      state.lookaheadWeight = parseFloat(e.target.value);
      elements.valLookahead.textContent = state.lookaheadWeight.toFixed(2);
      parseAndTranspile();
    });

    elements.sliderDecay.addEventListener('input', (e) => {
      state.decayFactor = parseFloat(e.target.value);
      elements.valDecay.textContent = state.decayFactor.toFixed(2);
      parseAndTranspile();
    });

    // Checkboxes
    elements.checkZne.addEventListener('change', (e) => {
      state.enableZne = e.target.checked;
      renderZneVisuals();
    });

    elements.checkRoem.addEventListener('change', (e) => {
      state.enableRoem = e.target.checked;
      renderReadoutVisuals();
    });

    // Action Buttons
    elements.btnParse.addEventListener('click', parseAndTranspile);
    elements.btnQuickRun.addEventListener('click', () => {
      parseAndTranspile();
      showToast("Transpilación completa ejecutada exitosamente.", "success");
    });

    elements.btnExportQasm.addEventListener('click', () => {
      // Activa la pestaña de exportación
      document.querySelector('[data-tab="tab-qasm-out"]').click();
    });

    // SABRE Player Controls
    elements.btnSabrePrev.addEventListener('click', () => {
      if (state.currentSabreStep > 0) {
        state.currentSabreStep--;
        updateSabrePlayerView();
      }
    });

    elements.btnSabreNext.addEventListener('click', () => {
      if (state.sabreResult && state.currentSabreStep < state.sabreResult.swapTrace.length - 1) {
        state.currentSabreStep++;
        updateSabrePlayerView();
      }
    });

    elements.btnSabrePlay.addEventListener('click', toggleSabrePlay);

    // Code & Export actions
    elements.btnCopyTranspiled.addEventListener('click', () => {
      navigator.clipboard.writeText(state.finalQasm);
      showToast("Código OpenQASM copiado al portapapeles.", "info");
    });

    elements.btnDownloadQasm.addEventListener('click', () => {
      downloadFile(state.finalQasm, `transpiled_${state.qpuKey}.qasm`, "text/plain");
      showToast("Archivo .qasm descargado.", "success");
    });

    elements.btnDownloadQiskitPy.addEventListener('click', () => {
      const top = ProblemEngine.TOPOLOGIES[state.qpuKey];
      const pyCode = QasmBridge.generateQiskitScript(top.numQubits, state.transpiledInstructions, top.name);
      downloadFile(pyCode, `run_${state.qpuKey}.py`, "text/x-python");
      showToast("Script ejecutable Qiskit descargado.", "success");
    });

    // SQLite Cache Buttons
    elements.btnSaveCache.addEventListener('click', async () => {
      if (!state.parsedCircuit) return;
      const hash = QuantumBridgeDB.generateHash(elements.editorQasm.value, state.qpuKey, {
        alpha: state.lookaheadWeight,
        decay: state.decayFactor,
        basis: state.basisSet
      });
      await QuantumBridgeDB.saveTranspilation({
        circuitHash: hash,
        backend: state.qpuKey,
        numQubits: state.parsedCircuit.numQubits,
        swaps: state.sabreResult?.swapCount || 0,
        qasm: state.finalQasm
      });
      updateSqliteCounter();
      showToast("Transpilación y topología guardadas en caché local.", "success");
    });

    elements.btnClearCache.addEventListener('click', async () => {
      await QuantumBridgeDB.clearCache();
      updateSqliteCounter();
      showToast("Caché local reiniciada.", "info");
    });

    // Canvas Tooltip & Interaction
    setupCanvasHover();
  }

  function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPane = document.getElementById(btn.getAttribute('data-tab'));
        if (targetPane) targetPane.classList.add('active');

        // Re-render canvases if needed for crisp dimensions
        if (btn.getAttribute('data-tab') === 'tab-topology') renderTopologyCanvas();
        if (btn.getAttribute('data-tab') === 'tab-zne') renderZneVisuals();
      });
    });
  }

  async function updateSqliteCounter() {
    const count = await QuantumBridgeDB.countRecords();
    elements.sqliteCount.textContent = `${count} transpilaciones en caché`;
  }

  /**
   * Pipeline Central de Transpilación Cuántica
   */
  function parseAndTranspile() {
    try {
      const qasmCode = elements.editorQasm.value;
      const parsed = QasmBridge.parse(qasmCode);
      state.parsedCircuit = parsed;

      // Stats badge
      elements.inputStatsBadge.textContent = `Qubits: ${parsed.numQubits} | Puertas: ${parsed.instructions.length}`;

      // 1. Ejecutar Algoritmo SABRE
      const sabreRes = ProblemEngine.runSABRE(parsed, state.qpuKey, {
        lookaheadWeight: state.lookaheadWeight,
        decayFactor: state.decayFactor
      });
      state.sabreResult = sabreRes;
      state.currentSabreStep = 0;

      // 2. Descomposición a Conjunto Nativo
      const decompOps = [];
      for (const inst of sabreRes.routedInstructions) {
        const subOps = QasmBridge.decomposeInstruction(inst, state.basisSet);
        decompOps.push(...subOps);
      }
      state.transpiledInstructions = decompOps;

      // 3. Generar OpenQASM 3.0 Transpilado
      const top = ProblemEngine.TOPOLOGIES[state.qpuKey];
      const finalQasm = QasmBridge.generateTranspiledQASM(top.numQubits, decompOps, state.basisSet, top.name);
      state.finalQasm = finalQasm;
      elements.codeTranspiled.textContent = finalQasm;

      // 4. Actualizar KPIs
      updateKpis(parsed, sabreRes, decompOps, top);

      // 5. Renderizar Vistas
      renderTopologyCanvas();
      renderMappingChips();
      renderCircuitDiagrams(parsed, decompOps);
      updateSabrePlayerView();
      renderZneVisuals();
      renderReadoutVisuals();
      renderNativeDecompositions();

      elements.footerMsg.textContent = `Transpilación completada: ${sabreRes.swapCount} SWAPs introducidos para topología ${top.name}.`;
    } catch (err) {
      console.error(err);
      showToast("Error en transpilación: " + err.message, "danger");
      elements.footerMsg.textContent = "Error al transpilar circuito.";
    }
  }

  /**
   * Actualiza las Métricas Cuánticas Clave (KPIs)
   */
  function updateKpis(origCirc, sabreRes, transOps, top) {
    const orig2Q = origCirc.instructions.filter(i => i.targets.length === 2).length;
    const trans2Q = transOps.filter(i => (i.physicalTargets || i.targets).length === 2).length;
    const origDepth = Math.max(1, Math.ceil(origCirc.instructions.length / Math.max(1, origCirc.numQubits / 2)));
    const transDepth = Math.max(1, Math.ceil(transOps.length / Math.max(1, top.numQubits / 2)));

    elements.kpiCnotBefore.textContent = orig2Q;
    elements.kpiCnotAfter.textContent = trans2Q;
    elements.kpiCnotDelta.textContent = `+${Math.max(0, trans2Q - orig2Q)} compuertas añadidas`;

    elements.kpiDepthBefore.textContent = origDepth;
    elements.kpiDepthAfter.textContent = transDepth;
    const ratio = (transDepth / origDepth).toFixed(2);
    elements.kpiDepthDelta.textContent = `Ratio de expansión: ${ratio}x`;

    elements.kpiSwapsCount.textContent = `${sabreRes.swapCount} SWAPs`;
    elements.kpiSwapsHardware.textContent = `Cumpliendo conectividad ${top.name}`;

    // Fidelidad estimada ESP (Estimated Success Probability)
    // Formula NISQ: F = (1 - e_1q)^N_1q * (1 - e_2q)^N_2q * (1 - e_ro)^N_qubits
    const e2Q = top.cnotError;
    const e1Q = e2Q * 0.1;
    const eRo = top.readoutError;
    const rawFidelity = Math.pow(1 - e1Q, transOps.length - trans2Q) *
                        Math.pow(1 - e2Q, trans2Q) *
                        Math.pow(1 - eRo, origCirc.numQubits);

    const fPerc = (Math.max(0.05, rawFidelity) * 100).toFixed(1);
    elements.kpiFidelityVal.textContent = `${fPerc}%`;

    // ZNE Mitigated Fidelity
    const zneRes = ProblemEngine.computeZNE(rawFidelity);
    const znePerc = (zneRes.mitigated * 100).toFixed(1);
    elements.kpiFidelityZne.textContent = `${znePerc}%`;
  }

  /**
   * Renderizado de la Topología y Grafo QPU en Canvas
   */
  function renderTopologyCanvas() {
    const canvas = elements.canvasTopology;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const top = ProblemEngine.TOPOLOGIES[state.qpuKey];
    if (!top) return;

    // Dibujar enlaces de acoplamiento (Coupling Map)
    ctx.lineWidth = 2.5;
    const sabre = state.sabreResult;
    const activePhysicals = new Set();
    if (sabre) {
      sabre.finalLayout.forEach(p => activePhysicals.add(p));
    }

    if (state.qpuKey === 'all_to_all') {
      ctx.strokeStyle = 'hsla(186, 100%, 50%, 0.15)';
      for (let i = 0; i < top.numQubits; i++) {
        for (let j = i + 1; j < top.numQubits; j++) {
          const p1 = top.positions[i];
          const p2 = top.positions[j];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    } else {
      for (const [u, v] of top.couplingMap) {
        if (u < top.numQubits && v < top.numQubits) {
          const p1 = top.positions[u];
          const p2 = top.positions[v];
          
          const isHighlighted = activePhysicals.has(u) && activePhysicals.has(v);
          ctx.strokeStyle = isHighlighted ? 'hsla(315, 95%, 62%, 0.45)' : 'hsla(217, 33%, 35%, 0.35)';
          ctx.lineWidth = isHighlighted ? 3 : 1.5;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // Dibujar Nodos (Qubits Físicos)
    const currentStepSwap = sabre?.swapTrace?.[state.currentSabreStep]?.swap || null;

    top.positions.forEach((pos, idx) => {
      // Determinar si este qubit físico aloja un qubit lógico
      let logicalIdx = -1;
      if (sabre) {
        logicalIdx = sabre.finalLayout.indexOf(idx);
      }

      const isCurrentSwap = currentStepSwap && (currentStepSwap[0] === idx || currentStepSwap[1] === idx);

      // Glow exterior
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
      if (isCurrentSwap) {
        ctx.fillStyle = 'hsla(42, 95%, 55%, 0.3)';
        ctx.fill();
      } else if (logicalIdx !== -1) {
        ctx.fillStyle = 'hsla(186, 100%, 50%, 0.2)';
        ctx.fill();
      }

      // Círculo del qubit
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
      if (isCurrentSwap) {
        ctx.fillStyle = 'hsl(42, 95%, 52%)';
      } else if (logicalIdx !== -1) {
        ctx.fillStyle = 'hsl(186, 100%, 50%)';
      } else {
        ctx.fillStyle = 'hsl(222, 35%, 20%)';
      }
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isCurrentSwap ? '#ffffff' : (logicalIdx !== -1 ? '#a5f3fc' : 'hsl(220, 25%, 35%)');
      ctx.stroke();

      // Texto de identificación
      ctx.fillStyle = (logicalIdx !== -1 || isCurrentSwap) ? '#0f172a' : '#94a3b8';
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = logicalIdx !== -1 ? `q${logicalIdx}` : `Q${idx}`;
      ctx.fillText(label, pos.x, pos.y);

      // Sub-label debajo del nodo
      ctx.fillStyle = '#64748b';
      ctx.font = '9px JetBrains Mono';
      ctx.fillText(`phys:${idx}`, pos.x, pos.y + 26);
    });
  }

  function renderMappingChips() {
    const container = elements.mappingChipsList;
    container.innerHTML = '';
    const sabre = state.sabreResult;
    if (!sabre) return;

    sabre.finalLayout.forEach((physIdx, logIdx) => {
      const chip = document.createElement('div');
      chip.className = 'mapping-chip';
      const initPhys = sabre.initialLayout[logIdx];
      chip.innerHTML = `
        <span class="chip-logical">L${logIdx}</span> &rarr;
        <span class="chip-physical">P${physIdx}</span>
        <small style="color:var(--text-muted);">(init: P${initPhys})</small>
      `;
      container.appendChild(chip);
    });
  }

  /**
   * Renderizado de Diagramas de Circuitos en SVG
   */
  function renderCircuitDiagrams(origCirc, transOps) {
    // 1. Circuito Original
    elements.renderOrig.innerHTML = generateCircuitSvg(origCirc.numQubits, origCirc.instructions, false);
    // 2. Circuito Transpilado
    const top = ProblemEngine.TOPOLOGIES[state.qpuKey];
    elements.renderTrans.innerHTML = generateCircuitSvg(top.numQubits, transOps.slice(0, 36), true);
  }

  function generateCircuitSvg(numQubits, instructions, isTranspiled) {
    const qHeight = 36;
    const colWidth = 44;
    const totalCols = Math.max(instructions.length + 1, 8);
    const svgWidth = Math.max(380, totalCols * colWidth + 60);
    const svgHeight = numQubits * qHeight + 30;

    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family:'JetBrains Mono',monospace;">`;

    // Líneas de alambre cuántico (wires)
    for (let i = 0; i < numQubits; i++) {
      const y = 20 + i * qHeight;
      svg += `<text x="12" y="${y + 4}" fill="#94a3b8" font-size="10">q[${i}]</text>`;
      svg += `<line x1="45" y1="${y}" x2="${svgWidth - 10}" y2="${y}" stroke="rgba(148,163,184,0.25)" stroke-width="1.5" />`;
    }

    // Dibujar compuertas a lo largo de las columnas
    let currentX = 65;
    for (const inst of instructions) {
      const targets = inst.physicalTargets || inst.targets;
      const name = inst.name.toLowerCase();

      if (targets.length === 1) {
        const q = targets[0];
        if (q < numQubits) {
          const y = 20 + q * qHeight;
          const isPhase = name === 'rz' || name === 'rx';
          const fill = isPhase ? '#0284c7' : '#0891b2';
          svg += `<rect x="${currentX - 14}" y="${y - 12}" width="28" height="24" rx="4" fill="${fill}" stroke="#38bdf8" stroke-width="1"/>`;
          svg += `<text x="${currentX}" y="${y + 4}" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">${name.toUpperCase()}</text>`;
        }
      } else if (targets.length === 2) {
        const [c, t] = targets;
        if (c < numQubits && t < numQubits) {
          const yC = 20 + c * qHeight;
          const yT = 20 + t * qHeight;

          // Línea de control vertical
          svg += `<line x1="${currentX}" y1="${yC}" x2="${currentX}" y2="${yT}" stroke="#ec4899" stroke-width="2"/>`;

          if (name === 'swap') {
            // Símbolo de SWAP (dos X)
            svg += `<text x="${currentX}" y="${yC + 4}" fill="#f43f5e" font-size="14" font-weight="bold" text-anchor="middle">&times;</text>`;
            svg += `<text x="${currentX}" y="${yT + 4}" fill="#f43f5e" font-size="14" font-weight="bold" text-anchor="middle">&times;</text>`;
          } else {
            // Punto de control CNOT
            svg += `<circle cx="${currentX}" cy="${yC}" r="4.5" fill="#ec4899"/>`;
            // Objetivo CNOT (+ en círculo)
            svg += `<circle cx="${currentX}" cy="${yT}" r="9" fill="none" stroke="#ec4899" stroke-width="2"/>`;
            svg += `<line x1="${currentX - 9}" y1="${yT}" x2="${currentX + 9}" y2="${yT}" stroke="#ec4899" stroke-width="2"/>`;
            svg += `<line x1="${currentX}" y1="${yT - 9}" x2="${currentX}" y2="${yT + 9}" stroke="#ec4899" stroke-width="2"/>`;
          }
        }
      }
      currentX += colWidth;
    }

    svg += `</svg>`;
    return svg;
  }

  /**
   * Actualiza el Simulador / Reproductor Heurístico SABRE
   */
  function updateSabrePlayerView() {
    const sabre = state.sabreResult;
    if (!sabre || sabre.swapTrace.length === 0) {
      elements.sabreStepCounter.textContent = "0 SWAPs";
      elements.sabreFrontLayer.innerHTML = `<span style="color:var(--text-muted);font-size:0.75rem;">Sin inserción de SWAPs requerida (conectividad nativa directa).</span>`;
      elements.sabreCandidatesTable.innerHTML = `<div style="color:var(--text-muted);padding:0.5rem;">Todas las compuertas cumplen las reglas topológicas.</div>`;
      elements.sabreLogTerminal.textContent = `[SABRE Initializer] Circuito evaluado. Todas las compuertas satisfacen el grafo de acoplamiento.`;
      return;
    }

    const stepIdx = state.currentSabreStep;
    const currentTrace = sabre.swapTrace[stepIdx];
    elements.sabreStepCounter.textContent = `Paso ${stepIdx + 1} / ${sabre.swapTrace.length}`;

    // Front Layer
    elements.sabreFrontLayer.innerHTML = `
      <span class="gate-badge">CNOT resolviendo: Q${currentTrace.swap[0]} &harr; Q${currentTrace.swap[1]}</span>
      <span class="gate-badge" style="border-color:var(--accent-magenta);">Qubits Lógicos: L${currentTrace.swappedLogical[0]} &harr; L${currentTrace.swappedLogical[1]}</span>
    `;

    // Tabla de candidatos evaluados
    let tableHtml = `<table><thead><tr><th>Arista SWAP</th><th>H_Front</th><th>H_Ext</th><th>Score Heurístico</th></tr></thead><tbody>`;
    currentTrace.candidatesEvaluated.slice(0, 5).forEach(c => {
      const isChosen = c.swap[0] === currentTrace.swap[0] && c.swap[1] === currentTrace.swap[1];
      tableHtml += `<tr style="${isChosen ? 'background:hsla(186,100%,50%,0.15);font-weight:bold;color:#38bdf8;' : ''}">
        <td>SWAP(Q${c.swap[0]}, Q${c.swap[1]})</td>
        <td>${c.hFront}</td>
        <td>${c.hExt}</td>
        <td>${c.score} ${isChosen ? '★ (Óptimo)' : ''}</td>
      </tr>`;
    });
    tableHtml += `</tbody></table>`;
    elements.sabreCandidatesTable.innerHTML = tableHtml;

    // Bitácora del terminal
    let log = `=== SABRE HEURISTIC TRACE STEP ${stepIdx + 1} ===\n`;
    log += `[HEURISTIC] Cost Front Layer + ${state.lookaheadWeight.toFixed(2)} * Lookahead Extended Layer.\n`;
    log += `[DECISION] Swap seleccionado: Arista (Q${currentTrace.swap[0]}, Q${currentTrace.swap[1]})\n`;
    log += `[TOPOLOGY] Intercambio de mapeo: L${currentTrace.swappedLogical[0]} pasa a Q${currentTrace.swap[1]}, L${currentTrace.swappedLogical[1]} pasa a Q${currentTrace.swap[0]}.\n`;
    log += `[STATUS] Conectividad reducida a distancia = 1. Compuerta de 2 qubits desbloqueada.\n`;
    elements.sabreLogTerminal.textContent = log;

    // Redibujar topología destacando el paso
    renderTopologyCanvas();
  }

  function toggleSabrePlay() {
    state.isPlayingSabre = !state.isPlayingSabre;
    if (state.isPlayingSabre) {
      elements.btnSabrePlay.textContent = "Pausar";
      state.playInterval = setInterval(() => {
        if (state.sabreResult && state.currentSabreStep < state.sabreResult.swapTrace.length - 1) {
          state.currentSabreStep++;
          updateSabrePlayerView();
        } else {
          toggleSabrePlay();
        }
      }, 900);
    } else {
      elements.btnSabrePlay.textContent = "Reproducir";
      if (state.playInterval) clearInterval(state.playInterval);
    }
  }

  /**
   * Renderizado de la Curva ZNE (Zero-Noise Extrapolation)
   */
  function renderZneVisuals() {
    const canvas = elements.canvasZneCurve;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const fidelityNum = parseFloat(elements.kpiFidelityVal.textContent) / 100 || 0.85;
    const zneData = ProblemEngine.computeZNE(fidelityNum);

    // Ejes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 20); ctx.lineTo(50, h - 35);
    ctx.lineTo(w - 20, h - 35);
    ctx.stroke();

    // Etiquetas ejes
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('Ruido (\u03BB)', w - 65, h - 15);
    ctx.fillText('Fidelidad / <O>', 10, 16);

    // Mapeo coordenadas
    const mapX = (lambda) => 50 + (lambda / 6.0) * (w - 80);
    const mapY = (exp) => (h - 35) - exp * (h - 70);

    // Dibujar Curva de Ajuste (Extrapolación a lambda = 0)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mapX(0), mapY(zneData.mitigated));
    ctx.lineTo(mapX(zneData.points[0].scale), mapY(zneData.points[0].expectation));
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Línea continua entre puntos medidos
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mapX(zneData.points[0].scale), mapY(zneData.points[0].expectation));
    for (let i = 1; i < zneData.points.length; i++) {
      ctx.lineTo(mapX(zneData.points[i].scale), mapY(zneData.points[i].expectation));
    }
    ctx.stroke();

    // Dibujar Puntos Medidos (lambda = 1, 3, 5)
    zneData.points.forEach(pt => {
      ctx.beginPath();
      ctx.arc(mapX(pt.scale), mapY(pt.expectation), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`\u03BB=${pt.scale.toFixed(1)}`, mapX(pt.scale) - 12, mapY(pt.expectation) - 10);
    });

    // Punto Extrapolado Zero-Noise (lambda = 0)
    ctx.beginPath();
    ctx.arc(mapX(0), mapY(zneData.mitigated), 7, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.fillText(`\u03BB=0: ${(zneData.mitigated * 100).toFixed(1)}%`, mapX(0) + 10, mapY(zneData.mitigated) + 4);

    // Tabla informativa ZNE
    elements.znePointsTable.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:0.35rem;border-bottom:1px solid var(--border-color);">
        <span>Factor \u03BB = 1.0 (Sin plegado):</span>
        <strong style="color:#f43f5e;">${(zneData.points[0].expectation * 100).toFixed(1)}%</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.35rem;border-bottom:1px solid var(--border-color);">
        <span>Factor \u03BB = 3.0 (Unitary Folding U-U\u2020-U):</span>
        <strong style="color:#f43f5e;">${(zneData.points[1]?.expectation * 100 || 0).toFixed(1)}%</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.35rem;background:hsla(150,70%,45%,0.15);border-radius:4px;">
        <span style="color:#10b981;font-weight:bold;">Extrapolación Límite Cero (\u03BB \u2192 0):</span>
        <strong style="color:#10b981;">${(zneData.mitigated * 100).toFixed(1)}%</strong>
      </div>
    `;
  }

  /**
   * Renderizado de la Matriz de Mitigación de Lectura (Readout Calibration)
   */
  function renderReadoutVisuals() {
    const numQubits = Math.min(3, state.parsedCircuit?.numQubits || 2);
    const rawProbs = [0.46, 0.04, 0.05, 0.45]; // Representación Bell/GHZ típica
    const calib = ProblemEngine.computeReadoutCalibration(2, rawProbs);

    // Renderizar Heatmap de Matriz M
    let matrixHtml = `<div style="font-size:0.72rem;font-family:var(--font-mono);margin-bottom:0.4rem;color:var(--text-muted);">Matriz de Transferencia SPAM M (2x2 subsistema):</div>`;
    matrixHtml += `<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:3px;max-width:280px;">`;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = calib.calibrationMatrix[r][c];
        const isDiag = r === c;
        const bg = isDiag ? 'hsla(186, 100%, 50%, 0.3)' : 'hsla(220, 20%, 25%, 0.5)';
        matrixHtml += `<div style="background:${bg};padding:4px;border-radius:3px;text-align:center;font-size:0.68rem;color:#e2e8f0;">${val.toFixed(2)}</div>`;
      }
    }
    matrixHtml += `</div>`;
    elements.readoutMatrixContainer.innerHTML = matrixHtml;

    // Histogramas comparativos
    const states = ["|00⟩", "|01⟩", "|10⟩", "|11⟩"];
    let histHtml = '';
    for (let i = 0; i < 4; i++) {
      const rawPct = (rawProbs[i] * 100).toFixed(1);
      const mitPct = (calib.mitigatedProbabilities[i] * 100).toFixed(1);

      histHtml += `
        <div class="hist-row">
          <span class="hist-label">${states[i]}</span>
          <div class="hist-bars-group">
            <div class="bar-wrap" title="Medición cruda (Raw): ${rawPct}%">
              <div class="bar-fill-raw" style="width:${rawPct}%;"></div>
            </div>
            <div class="bar-wrap" title="Medición mitigada (M^-1): ${mitPct}%">
              <div class="bar-fill-mitigated" style="width:${mitPct}%;"></div>
            </div>
          </div>
          <span class="hist-num">${mitPct}%</span>
        </div>
      `;
    }
    elements.histStateDist.innerHTML = histHtml;
  }

  /**
   * Renderizado de Tarjetas de Descomposición Nativa
   */
  function renderNativeDecompositions() {
    const basis = state.basisSet;
    const cards = [
      {
        target: "Hadamard (H)",
        formula: basis === 'ibm_basis' ? "Rz(π/2) · SX · Rz(π/2)" : (basis === 'google_basis' ? "PhasedXZ(0, π/2, π/2)" : "Rz(π/2) · Rx(π/2) · Rz(π/2)"),
        notes: "Conversión de superposición a rotaciones de Euler Z-X-Z."
      },
      {
        target: "SWAP Gate",
        formula: basis === 'ibm_basis' ? "CX(c,t) · CX(t,c) · CX(c,t)" : (basis === 'google_basis' ? "fSim(π/2, 0) / 3 CZs" : "3 CZ + rotaciones Rx"),
        notes: "3 compuertas de 2 qubits para intercambiar estados cuánticos."
      },
      {
        target: "Controlled-Z (CZ)",
        formula: basis === 'ibm_basis' ? "H(t) · CX(c,t) · H(t)" : "Nativa directa en Sycamore y Rigetti Ankaa",
        notes: "Inversión de fase condicional entre acopladores superconductores."
      },
      {
        target: "Pauli-X (NOT)",
        formula: basis === 'ibm_basis' ? "SX · SX o pulso físico de microondas π" : "PhasedXZ(0, π, 0)",
        notes: "Flip de estado |0⟩ ↔ |1⟩ mediante excitación resonante."
      }
    ];

    let html = '';
    cards.forEach(c => {
      html += `
        <div class="decomp-card">
          <div class="decomp-target-name">
            <span>${c.target}</span>
            <span class="badge-tag">${state.basisSet.replace('_basis','').toUpperCase()}</span>
          </div>
          <div class="decomp-formula">${c.formula}</div>
          <div class="decomp-notes">${c.notes}</div>
        </div>
      `;
    });
    elements.decompCardsContainer.innerHTML = html;
  }

  /**
   * Hover e interacciones en Canvas de Topología
   */
  function setupCanvasHover() {
    const canvas = elements.canvasTopology;
    const tooltip = elements.qpuTooltip;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const top = ProblemEngine.TOPOLOGIES[state.qpuKey];
      if (!top) return;

      let found = null;
      top.positions.forEach((pos, idx) => {
        const d = Math.hypot(pos.x - mouseX, pos.y - mouseY);
        if (d <= 20) {
          found = { idx, pos };
        }
      });

      if (found) {
        const logicalIdx = state.sabreResult?.finalLayout.indexOf(found.idx) ?? -1;
        tooltip.style.display = 'block';
        tooltip.style.left = `${found.pos.x + 20}px`;
        tooltip.style.top = `${found.pos.y - 10}px`;
        tooltip.innerHTML = `
          <strong>Qubit Físico Q${found.idx}</strong><br>
          ${logicalIdx !== -1 ? `<span style="color:var(--accent-cyan);">Aloja: Qubit Lógico q[${logicalIdx}]</span><br>` : '<span style="color:var(--text-muted);">Estado: Inactivo / Ocioso</span><br>'}
          T1: ${top.t1} μs | T2: ${top.t2} μs<br>
          Error CNOT: ${(top.cnotError * 100).toFixed(2)}%
        `;
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }

  /**
   * Utilidades Auxiliares (Toast, Descargas)
   */
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span style="color:${type === 'success' ? 'var(--success)' : (type === 'danger' ? 'var(--danger)' : 'var(--accent-cyan)')};">●</span>
      <span>${msg}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Ejecución al cargar
  window.addEventListener('DOMContentLoaded', init);
})();
