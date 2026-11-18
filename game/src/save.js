// Vice Rush 3D — save / load progress to localStorage after each mission.
const KEY = 'vice-rush-3d-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch { return null; }
}

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      respect: state.respect,
      x: state.playerX,
      z: state.playerZ,
      health: state.health,
      savedAt: Date.now(),
    }));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
