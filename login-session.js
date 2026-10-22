// Shared by the three quote applications. Durations are browser retention limits,
// not a replacement for Supabase authentication, active membership checks or RLS.
export const LOGIN_MODES = Object.freeze({
  DAY: '保持登入 24 小時',
  MONTH: '記住這台電腦 30 天（限個人專用電腦）',
  SESSION: '共用電腦／僅本次登入（目前分頁）',
});
const durations = { DAY: 86400000, MONTH: 30 * 86400000, SESSION: 0 };
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; };

export function createLoginSession({namespace, local, tab, now = () => Date.now(), uuid = () => crypto.randomUUID()}) {
  local ??= memory(); tab ??= memory();
  const savedKey = namespace + ':saved', tabKey = namespace + ':tab', choiceKey = namespace + ':choice';
  const sdkKey = namespace + ':sdk';
  let bound = null, armed = false, mode = 'DAY', invalid = false;
  const listeners = new Set();
  const parse = (store, key) => { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } };
  const valid = entry => entry && typeof entry.value === 'string' && typeof entry.id === 'string' &&
    Object.hasOwn(durations, entry.mode) && Number.isFinite(entry.startedAt) &&
    (entry.mode === 'SESSION' ? entry.expiresAt === null : Number.isFinite(entry.expiresAt) && entry.expiresAt === entry.startedAt + durations[entry.mode] && now() < entry.expiresAt) && now() >= entry.startedAt;
  function read() {
    const temporary = parse(tab, tabKey), saved = parse(local, savedKey);
    const entry = temporary || saved;
    if (valid(entry)) {
      if (bound && entry.id !== bound) return null; // another tab changed account
      return entry;
    }
    if (temporary) tab.removeItem(tabKey);
    if (saved) local.removeItem(savedKey);
    return null;
  }
  const initial = read();
  if (initial) { bound = initial.id; mode = initial.mode; }
  const notify = () => { if (!invalid) { invalid = true; for (const fn of listeners) fn(); } };
  const active = () => { const entry = read(); if (!entry && bound && !armed) notify(); return !!entry; };
  const preference = () => { const choice = local.getItem(choiceKey); return Object.hasOwn(durations,choice) ? choice : 'DAY'; };
  function begin(selected = 'DAY') {
    if (!Object.hasOwn(durations, selected)) throw new Error('請選擇有效的登入保存方式');
    // Probe selected storage before sending a password. Do not silently promise retention.
    const store = selected === 'SESSION' ? tab : local;
    try { store.setItem(namespace + ':probe','1'); store.removeItem(namespace + ':probe'); }
    catch { throw new Error('瀏覽器不允許保存登入，請開放網站儲存權限或使用一般瀏覽模式。'); }
    tab.removeItem(tabKey); local.removeItem(savedKey);
    mode = selected; bound = null; armed = true; invalid = false;
    try { local.setItem(choiceKey,selected); } catch { /* session-only login still works */ }
  }
  function clear() {
    tab.removeItem(tabKey); local.removeItem(savedKey);
    bound = null; armed = false; invalid = false;
  }
  const storage = {
    getItem(key) {
      if (key !== sdkKey) return tab.getItem(namespace + ':aux:' + key);
      const entry = read();
      if (!entry && bound && !armed) notify();
      return entry?.value ?? null;
    },
    setItem(key, value) {
      if (key !== sdkKey) { tab.setItem(namespace + ':aux:' + key, value); return; }
      let entry = read();
      if (!entry) {
        if (!armed) { if (bound) notify(); return; }
        const startedAt = now();
        entry = { id: uuid(), mode, startedAt, expiresAt: durations[mode] ? startedAt + durations[mode] : null, value };
      } else entry.value = value;
      // Token refresh updates the credential but never extends the selected deadline.
      (entry.mode === 'SESSION' ? tab : local).setItem(entry.mode === 'SESSION' ? tabKey : savedKey, JSON.stringify(entry));
      bound = entry.id; armed = false; invalid = false;
    },
    removeItem(key) {
      if (key !== sdkKey) { tab.removeItem(namespace + ':aux:' + key); return; }
      // A late sign-out/refresh failure in an older tab must not erase a newer login.
      for (const [store, key] of [[tab,tabKey],[local,savedKey]]) {
        const entry = parse(store,key);
        if (entry && entry.id === bound) store.removeItem(key);
      }
      bound = null; armed = false; invalid = false;
    },
  };
  return {
    storage, storageKey: sdkKey, begin, clear, active, preference,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    describe() { const e = read(); return e ? LOGIN_MODES[e.mode] + (e.expiresAt ? '；有效至 ' + new Date(e.expiresAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}) : '') : ''; },
    // Preserve an existing per-tab login during rollout without silently remembering it.
    migrateLegacy(store, key) { if (!read()) { const value = store.getItem(key); if (value) { begin('SESSION'); storage.setItem(sdkKey,value); store.removeItem(key); } } },
  };
}

export function watchLoginSession(lease, onExpired, target = globalThis) {
  const check = () => lease.active();
  const unsubscribe = lease.subscribe(onExpired);
  const timer = target.setInterval(check, 1000);
  target.addEventListener?.('storage', check);
  target.addEventListener?.('focus', check);
  const visible = () => { if (!target.document?.hidden) check(); };
  target.document?.addEventListener('visibilitychange', visible);
  return () => { unsubscribe(); target.clearInterval(timer); target.removeEventListener?.('storage',check); target.removeEventListener?.('focus',check); target.document?.removeEventListener('visibilitychange',visible); };
}
