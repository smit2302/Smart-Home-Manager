const STORE_KEY = 'smarthome_manager_store_v1';

export function emptyStore() {
  return { accounts: [], households: {}, sessionUserId: null };
}

export function loadStore() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (!saved) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(saved) };
  } catch {
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('SmartHome Manager could not save to localStorage', err);
  }
}

export function wipeStore() {
  localStorage.removeItem(STORE_KEY);
}

// Simulation only: a SHA-256 digest keeps plain passwords out of localStorage.
export async function hashPassword(password) {
  const salted = `smarthome::${password}`;
  if (window.crypto && window.crypto.subtle) {
    const bytes = new TextEncoder().encode(salted);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return btoa(salted);
}
