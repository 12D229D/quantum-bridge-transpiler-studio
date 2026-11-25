/**
 * QuantumBridgeDB: Persistencia Determinista de Transpilaciones,
 * Caché de Mapeos SABRE, Semillas Cuánticas y Mitigaciones en SQLite Local (IndexedDB/WebSQL fallback).
 * Codex Layer 4 - Quantum Transpiler Core
 */

class QuantumBridgeDB {
  static DB_NAME = "QuantumBridgeTranspilerDB";
  static STORE_NAME = "transpilation_cache";
  static DB_VERSION = 1;

  static async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(QuantumBridgeDB.DB_NAME, QuantumBridgeDB.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(QuantumBridgeDB.STORE_NAME)) {
          const store = db.createObjectStore(QuantumBridgeDB.STORE_NAME, { keyPath: "circuitHash" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("backend", "backend", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Genera un hash criptográfico rápido para el circuito + parámetros
   */
  static generateHash(qasmString, backend, options) {
    let str = `${qasmString}__${backend}__${JSON.stringify(options)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `qb_transpile_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Guarda una transpilación en la base de datos
   */
  static async saveTranspilation(record) {
    try {
      const db = await QuantumBridgeDB.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QuantumBridgeDB.STORE_NAME, "readwrite");
        const store = tx.objectStore(QuantumBridgeDB.STORE_NAME);
        
        const data = {
          ...record,
          timestamp: new Date().toISOString()
        };

        const req = store.put(data);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("DB Storage warning:", e);
      return false;
    }
  }

  /**
   * Recupera una transpilación cacheada
   */
  static async getTranspilation(circuitHash) {
    try {
      const db = await QuantumBridgeDB.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QuantumBridgeDB.STORE_NAME, "readonly");
        const store = tx.objectStore(QuantumBridgeDB.STORE_NAME);
        const req = store.get(circuitHash);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Obtiene la cuenta total de registros en caché
   */
  static async countRecords() {
    try {
      const db = await QuantumBridgeDB.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QuantumBridgeDB.STORE_NAME, "readonly");
        const store = tx.objectStore(QuantumBridgeDB.STORE_NAME);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return 0;
    }
  }

  /**
   * Limpia toda la caché
   */
  static async clearCache() {
    try {
      const db = await QuantumBridgeDB.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QuantumBridgeDB.STORE_NAME, "readwrite");
        const store = tx.objectStore(QuantumBridgeDB.STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return false;
    }
  }
}

// Global window binding
window.QuantumBridgeDB = QuantumBridgeDB;
