// ─── VoxScribe Firebase Configuration ───────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, limit, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8RCw-dHe57yINCqDIdFgu711lMP3-qLA",
  authDomain: "voxscribe-916.firebaseapp.com",
  projectId: "voxscribe-916",
  storageBucket: "voxscribe-916.firebasestorage.app",
  messagingSenderId: "306614399059",
  appId: "1:306614399059:web:c29fa84e871b8fc49556a6",
  measurementId: "G-WZJ0BSR91N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Export Firebase services
export { auth, db, provider, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged };
export { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, limit, where, serverTimestamp };

// Authentication state management
export let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
});

// Authentication functions
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}
