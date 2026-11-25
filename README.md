# Quantum Bridge & Multi-QPU Transpiler Studio (Capa 4 Codex)

> **Herramienta Cuántica Híbrida / DX** para transpilación, enrutamiento heurístico SABRE y mitigación de errores NISQ sobre topologías reales de computación cuántica.

---

## 📌 Descripción General
`quantum-bridge-transpiler-studio` resuelve los desafíos de compilación cuántica de complejidad computacional NP-completa:
1. **Mapeo Lógico a Físico (Initial Layout):** Asignación de qubits algorítmicos ideales a qubits superconductores físicos en procesadores IBM Quantum y Google Sycamore.
2. **Enrutamiento Heurístico SABRE (Swap-based Bounded Heuristic Lookahead):** Inserción automatizada de puertas SWAP minimizando la expansión de profundidad y la tasa de error mediante función de costo:
   $$H_{\text{SABRE}} = \frac{1}{|F|} \sum_{g \in F} D(q_1, q_2) + \alpha \frac{1}{|E|} \sum_{g \in E} D(q_1, q_2)$$
3. **Descomposición a Conjuntos de Puertas Nativas:**
   - **IBM Transmon:** $\{sx, x, rz, cx\}$
   - **Google Sycamore / Willow:** $\{PhasedXZ, fSim, cz\}$
   - **Rigetti Ankaa:** $\{rx, rz, cz\}$
4. **Mitigación de Errores NISQ:**
   - **Zero-Noise Extrapolation (ZNE):** Amplificación unitaria de ruido por plegado de puertas CNOT ($U \to U U^\dagger U$) con escalas $\lambda \in \{1.0, 3.0, 5.0\}$ y extrapolación al límite $\lambda \to 0$.
   - **Readout Error Mitigation:** Inversión de la matriz de calibración de medición $M^{-1}$ para corregir errores de preparación y lectura de estado (SPAM).
5. **Generador y Exportador:** Generación de OpenQASM 3.0 estándar y scripts ejecutables en Python / Qiskit 1.x.

---

## 🚀 Características y Arquitectura
- **Frontend SPA Puro (Vanilla JS ES2024 + HTML5 Semántico + CSS3 HSL):** Sin dependencias externas pesadas.
- **Topologías Soportadas:**
  - IBM Eagle / Heron (Heavy-Hex de 16 Qubits)
  - IBM Falcon Line/T (5 Qubits)
  - Google Sycamore (Grid 4x4 de 16 Qubits)
  - Anillo Cuántico (Ring 8 Qubits)
  - Topología Estrella (Star 5 Qubits)
  - All-to-All Ideal
- **Persistencia Determinista Local:** Caché en base de datos local (IndexedDB / SQLite spec) para indexar resultados de transpilación y reutilizar mapeos óptimos.
- **Cumplimiento estricto de DESIGN.md:** Paleta Cyber-Quantum Dark, tipografías Google Fonts (*JetBrains Mono* + *Inter*), microinteracciones y efectos de glassmorphism.
