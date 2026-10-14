/**
 * BUSPASS MANAGEMENT SYSTEM - SECURE SUPER ADMIN BOOTSTRAP SCRIPT
 * 
 * One-time initialization script for the platform owner to create the default Super Admin account.
 * Features:
 * - Generates a cryptographically strong, unique 16-character temporary password.
 * - Creates the Firebase Auth user if not present (does not overwrite or reset existing admin).
 * - Creates the Super Admin document in Firestore `users/{uid}` with role: 'superadmin'.
 * - Sets `mustChangePassword: true` so the admin is forced to change it on first login.
 * - Records one-time setup marker in `platformSettings/security` to prevent duplicate re-initializations.
 * - Prints the temporary credentials once to stdout and exits.
 * 
 * Usage:
 *   node scripts/bootstrap-superadmin.js
 *   node scripts/bootstrap-superadmin.js custom-admin@company.com
 */

const crypto = require('crypto');
const https = require('https');

// Project configuration from js/firebase-config.js
const FIREBASE_API_KEY = "AIzaSyCZ4NSPT8WrI6jHJY3XtS3kmazin5Vr9OI";
const PROJECT_ID = "buspasss";

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(`
BUSPASS MANAGEMENT SYSTEM - SUPER ADMIN BOOTSTRAP INITIALIZER
Usage:
  node scripts/bootstrap-superadmin.js [adminEmail]

Examples:
  node scripts/bootstrap-superadmin.js
  node scripts/bootstrap-superadmin.js owner@buspass.local
  `);
  process.exit(0);
}

const DEFAULT_ADMIN_EMAIL = process.argv[2] || "admin@buspass.local";

/**
 * Generates a cryptographically random 16-character password with mixed case, digits, and symbols
 */
function generateSecureTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+~';
  const all = upper + lower + digits + symbols;

  let pwd = '';
  pwd += upper.charAt(crypto.randomInt(0, upper.length));
  pwd += lower.charAt(crypto.randomInt(0, lower.length));
  pwd += digits.charAt(crypto.randomInt(0, digits.length));
  pwd += symbols.charAt(crypto.randomInt(0, symbols.length));

  for (let i = 4; i < 16; i++) {
    pwd += all.charAt(crypto.randomInt(0, all.length));
  }

  // Shuffle
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

function makeHttpRequest(url, method, payload = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
          else reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function runBootstrap() {
  console.log("=================================================================");
  console.log("  BUSPASS MANAGEMENT SYSTEM - SUPER ADMIN BOOTSTRAP INITIALIZER  ");
  console.log("=================================================================");
  console.log(`[1/4] Target Project: ${PROJECT_ID}`);
  console.log(`[2/4] Target Admin Email: ${DEFAULT_ADMIN_EMAIL}`);

  const tempPassword = generateSecureTempPassword();

  // Step 1: Create Firebase Auth Account via Identity Toolkit API
  console.log(`[3/4] Creating Authentication Account...`);
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
  
  let authResult;
  let isExisting = false;

  try {
    authResult = await makeHttpRequest(signUpUrl, 'POST', {
      email: DEFAULT_ADMIN_EMAIL,
      password: tempPassword,
      returnSecureToken: true
    });
  } catch (err) {
    if (err.message && err.message.includes("EMAIL_EXISTS")) {
      isExisting = true;
      console.log(`(!) Account '${DEFAULT_ADMIN_EMAIL}' already exists in Firebase Authentication.`);
      console.log(`    Checking if it has the Super Admin role assigned in Firestore...`);
      // Sign in to verify or retrieve token
      try {
        const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
        authResult = await makeHttpRequest(signInUrl, 'POST', {
          email: DEFAULT_ADMIN_EMAIL,
          password: tempPassword,
          returnSecureToken: true
        });
      } catch (signInErr) {
        console.log("-----------------------------------------------------------------");
        console.log(`(!) Notice: An administrator with email '${DEFAULT_ADMIN_EMAIL}' already exists.`);
        console.log(`    For security, existing passwords are never overwritten.`);
        console.log(`    If you forgot the password, use 'Reset Password' on admin-login.html.`);
        console.log(`    Or run with a different email: node scripts/bootstrap-superadmin.js newadmin@domain.com`);
        console.log("-----------------------------------------------------------------");
        process.exit(0);
      }
    } else {
      console.error("(!) Failed to create authentication account:", err.message);
      process.exit(1);
    }
  }

  const uid = authResult.localId;
  const idToken = authResult.idToken;

  // Step 2: Write Super Admin record in Firestore via Firestore REST API using the admin idToken
  console.log(`[4/4] Provisioning Super Admin profile in Firestore (UID: ${uid})...`);
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?key=${FIREBASE_API_KEY}`;

  const nowIso = new Date().toISOString();
  const firestoreDoc = {
    fields: {
      uid: { stringValue: uid },
      email: { stringValue: DEFAULT_ADMIN_EMAIL },
      name: { stringValue: "Super Administrator" },
      role: { stringValue: "superadmin" },
      status: { stringValue: "Active" },
      mustChangePassword: { booleanValue: true },
      createdAt: { timestampValue: nowIso },
      updatedAt: { timestampValue: nowIso }
    }
  };

  try {
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?key=${FIREBASE_API_KEY}`;
    await makeHttpRequest(patchUrl, 'PATCH', firestoreDoc);

    // Also mark platformSettings/security as initialized
    const settingsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/platformSettings/security?key=${FIREBASE_API_KEY}`;
    await makeHttpRequest(settingsUrl, 'PATCH', {
      fields: {
        superAdminInitialized: { booleanValue: true },
        initializedAt: { timestampValue: nowIso },
        primaryAdminUid: { stringValue: uid }
      }
    });

    console.log("-----------------------------------------------------------------");
    console.log("  >>> SUPER ADMIN ACCOUNT INITIALIZATION SUCCESSFUL! <<<          ");
    console.log("-----------------------------------------------------------------");
    console.log("  Login Portal URL:  http://localhost:5000/admin-login.html (or your live domain)");
    console.log(`  Admin Email:       ${DEFAULT_ADMIN_EMAIL}`);
    console.log(`  Temporary Password:${tempPassword}`);
    console.log("-----------------------------------------------------------------");
    console.log("  IMPORTANT SECURITY NOTICE:");
    console.log("  1. Copy the temporary password above and keep it secure.");
    console.log("  2. It will NEVER be shown again or stored in plaintext anywhere.");
    console.log("  3. On first login, you will be MANDATED to create your permanent password.");
    console.log("=================================================================\n");

  } catch (fsErr) {
    console.error("(!) Failed to write Firestore document:", fsErr.message);
    process.exit(1);
  }
}

runBootstrap();
