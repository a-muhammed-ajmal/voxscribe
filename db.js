// ─── VoxScribe Firestore Layer ───────────────────────────────────────────────
import { auth, db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, limit, where, serverTimestamp, currentUser } from './firebase.js';

const STORE = 'recordings';
const MAX_RECORDS = 10;

export function initDB() {
    return new Promise((resolve) => {
        // Firebase is already initialized in firebase.js
        resolve();
    });
}

export async function saveRecording(recording) {
    if (!currentUser) {
        throw new Error('User not authenticated');
    }
    
    try {
        const userRecordingsRef = collection(db, 'users', currentUser.uid, STORE);
        const recordingRef = doc(userRecordingsRef, recording.id);
        
        await setDoc(recordingRef, {
            ...recording,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
            syncedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving recording:', error);
        throw error;
    }
}

export async function getAllRecordings() {
    if (!currentUser) {
        return [];
    }
    
    try {
        const userRecordingsRef = collection(db, 'users', currentUser.uid, STORE);
        const q = query(userRecordingsRef, orderBy('createdAt', 'desc'), limit(MAX_RECORDS));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toMillis() || Date.now()
        }));
    } catch (error) {
        console.error('Error getting recordings:', error);
        return [];
    }
}

export async function deleteRecording(id) {
    if (!currentUser) {
        throw new Error('User not authenticated');
    }
    
    try {
        const recordingRef = doc(db, 'users', currentUser.uid, STORE, id);
        await deleteDoc(recordingRef);
    } catch (error) {
        console.error('Error deleting recording:', error);
        throw error;
    }
}

export async function pruneOldRecordings() {
    const all = await getAllRecordings();
    if (all.length > MAX_RECORDS) {
        const toDelete = all.slice(MAX_RECORDS);
        for (const rec of toDelete) {
            await deleteRecording(rec.id);
        }
    }
}
