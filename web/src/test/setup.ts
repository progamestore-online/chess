import "@testing-library/jest-dom/vitest";

// Vitest v4 + jsdom 29 don't reliably expose Storage; install a minimal in-memory
// polyfill so persistence tests can run.
function makeStorage(): Storage {
  let store: Record<string, string> = {}
  return {
    get length() { return Object.keys(store).length },
    clear() { store = {} },
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null },
    key(i) { return Object.keys(store)[i] ?? null },
    removeItem(k) { delete store[k] },
    setItem(k, v) { store[k] = String(v) },
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true })
}
if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStorage(), configurable: true })
}
