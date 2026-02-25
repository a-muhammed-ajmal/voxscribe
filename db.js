// ─── VoxScribe IndexedDB Layer ───────────────────────────────────────────────
const DB_NAME = 'voxscribe_db';
const DB_VERSION = 1;
const STORE = 'recordings';
const MAX_RECORDS = 10;

let db = null;

export function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE)) {
                const store = database.createObjectStore(STORE, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        req.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        req.onerror = (e) => reject(e.target.error);
    });
}

export function saveRecording(recording) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.put(recording);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

export function getAllRecordings() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const index = store.index('createdAt');
        const req = index.getAll();
        req.onsuccess = () => {
            const sorted = (req.result || []).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_RECORDS);
            resolve(sorted);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

export function deleteRecording(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

export async function pruneOldRecordings() {
    const all = await getAllRecordings();
    if (all.length >= MAX_RECORDS) {
        const toDelete = all.slice(MAX_RECORDS - 1);
        for (const rec of toDelete) {
            await deleteRecording(rec.id);
        }
    }
}
