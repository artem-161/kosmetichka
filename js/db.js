// Хранилище: IndexedDB в браузере телефона. Никаких серверов.
// IndexedDB выбран вместо localStorage, потому что фото средств
// быстро съели бы лимит localStorage (~5 МБ).

const DB_NAME = 'kosmetichka';
const DB_VERSION = 1;
const STORE = 'products';

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // При изменении схемы: подними DB_VERSION и добавь миграцию здесь.
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  all: () => run('readonly', (s) => s.getAll()),
  put: (item) => run('readwrite', (s) => { s.put(item); }),
  putMany: (items) => run('readwrite', (s) => { items.forEach((i) => s.put(i)); }),
  remove: (id) => run('readwrite', (s) => { s.delete(id); }),
  clear: () => run('readwrite', (s) => { s.clear(); }),
};
