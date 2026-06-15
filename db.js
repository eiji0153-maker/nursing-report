const DB_NAME = 'NursingReportDB';
const DB_VERSION = 1;

let db;

export function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('patients')) {
        const ps = d.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('name', 'name', { unique: false });
      }
      if (!d.objectStoreNames.contains('staff')) {
        const ss = d.createObjectStore('staff', { keyPath: 'id', autoIncrement: true });
        ss.createIndex('pin', 'pin', { unique: true });
      }
      if (!d.objectStoreNames.contains('history')) {
        const hs = d.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        hs.createIndex('patientId', 'patientId', { unique: false });
        hs.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!d.objectStoreNames.contains('phrases')) {
        d.createObjectStore('phrases', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

export const DB = {
  patients: {
    getAll: () => new Promise((res, rej) => { const r = tx('patients').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    get: id => new Promise((res, rej) => { const r = tx('patients').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    save: p => new Promise((res, rej) => { const s = tx('patients', 'readwrite'); const r = p.id ? s.put(p) : s.add(p); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    delete: id => new Promise((res, rej) => { const r = tx('patients', 'readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
  },
  staff: {
    getAll: () => new Promise((res, rej) => { const r = tx('staff').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    getByPin: pin => new Promise((res, rej) => { const r = tx('staff').index('pin').get(pin); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    save: s => new Promise((res, rej) => { const st = tx('staff', 'readwrite'); const r = s.id ? st.put(s) : st.add(s); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    delete: id => new Promise((res, rej) => { const r = tx('staff', 'readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
  },
  history: {
    getAll: () => new Promise((res, rej) => { const r = tx('history').getAll(); r.onsuccess = () => res(r.result.reverse()); r.onerror = () => rej(r.error); }),
    save: h => new Promise((res, rej) => { const r = tx('history', 'readwrite').add(h); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    delete: id => new Promise((res, rej) => { const r = tx('history', 'readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
  },
  phrases: {
    getAll: () => new Promise((res, rej) => { const r = tx('phrases').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    save: p => new Promise((res, rej) => { const st = tx('phrases', 'readwrite'); const r = p.id ? st.put(p) : st.add(p); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    delete: id => new Promise((res, rej) => { const r = tx('phrases', 'readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
  },
  settings: {
    get: key => new Promise((res, rej) => { const r = tx('settings').get(key); r.onsuccess = () => res(r.result?.value); r.onerror = () => rej(r.error); }),
    set: (key, value) => new Promise((res, rej) => { const r = tx('settings', 'readwrite').put({ key, value }); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
  }
};
