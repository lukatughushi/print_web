/**
 * The constructor's work in progress, kept in the browser (IndexedDB, which
 * holds the uploaded images' data URLs; localStorage is too small). Leaving
 * the page and coming back, or reloading, picks up where the customer was.
 * Every call fails quietly (private mode, blocked storage): the constructor
 * then simply starts empty.
 */
const DB = 'prenta';
const STORE = 'drafts';
const KEY = 'constructor';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDraft() {
  try {
    return (await run('readonly', (store) => store.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft) {
  try {
    await run('readwrite', (store) => store.put({ ...draft, savedAt: Date.now() }, KEY));
  } catch {
    /* storage unavailable or full: the draft just isn't kept */
  }
}
