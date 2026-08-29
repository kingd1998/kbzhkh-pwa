// Тонкая обёртка над IndexedDB. Три object store:
//  - positions  (keyPath: id)      — справочник позиций корма
//  - savedCalcs (keyPath: id)      — история сохранённых расчётов
//  - meta       (keyPath: key)     — { key: 'draftItems' | 'calcPositionIds' | 'seeded', value }
const DB = (() => {
  const DB_NAME = 'kbzhkh';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('positions')) db.createObjectStore('positions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('savedCalcs')) db.createObjectStore('savedCalcs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return wrap(store.getAll());
  }

  async function put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return wrap(store.put(value));
  }

  async function del(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return wrap(store.delete(key));
  }

  async function getMeta(key, fallback) {
    const store = await tx('meta', 'readonly');
    const row = await wrap(store.get(key));
    return row ? row.value : fallback;
  }

  async function setMeta(key, value) {
    return put('meta', { key, value });
  }

  return { getAll, put, del, getMeta, setMeta };
})();
