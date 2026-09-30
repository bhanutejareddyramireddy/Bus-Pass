/**
 * BUS PASS MANAGEMENT SYSTEM - FIREBASE CONFIGURATION
 * Vanilla JavaScript (Firebase Compat v10 SDK via CDN)
 */

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCZ4NSPT8WrI6jHJY3XtS3kmazin5Vr9OI",
  authDomain: "buspasss.firebaseapp.com",
  projectId: "buspasss",
  storageBucket: "buspasss.firebasestorage.app",
  messagingSenderId: "285496484521",
  appId: "1:285496484521:web:a09cfcaba3da61f0babfb8",
  measurementId: "G-SMB1T8R7MG"
};

// Check if user has saved a custom Firebase config in localStorage (convenient for testing custom Firebase projects without file edits)
const storedConfig = localStorage.getItem("BUSPASS_FIREBASE_CONFIG");
const activeConfig = storedConfig ? JSON.parse(storedConfig) : firebaseConfig;

// Initialize Primary Firebase App
if (!firebase.apps.length) {
  firebase.initializeApp(activeConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Optional Storage if available
let storage = null;
try {
  if (firebase.storage) {
    storage = firebase.storage();
  }
} catch (e) {
  console.warn("Firebase storage not initialized or not needed for base ops", e);
}

/**
 * Creates or gets a secondary Firebase App instance.
 * Used when a Vendor creates a Conductor account:
 * By calling createUserWithEmailAndPassword on secondaryAuth,
 * the vendor remains completely logged in on the primary auth instance!
 */
function getSecondaryApp() {
  try {
    return firebase.app("SecondaryConductorApp");
  } catch (e) {
    return firebase.initializeApp(activeConfig, "SecondaryConductorApp");
  }
}

function getSecondaryAuth() {
  return getSecondaryApp().auth();
}

/**
 * Helper to update Firebase configuration dynamically in development/demo
 */
function saveCustomFirebaseConfig(configObj) {
  localStorage.setItem("BUSPASS_FIREBASE_CONFIG", JSON.stringify(configObj));
  window.location.reload();
}
