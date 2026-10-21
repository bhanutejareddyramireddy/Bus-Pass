/**
 * BUS PASS MANAGEMENT SYSTEM - AUTHENTICATION MODULE
 * Secure Role-Based Access Control, Session Handling & Conductor Provisioning
 */

const AUTH_INTERNAL_DOMAIN = '@buspass.internal';

// Helper to generate unique Conductor ID (e.g., CON-7F42A9)
function generateConductorId() {
  const chars = '0123456789ABCDEF';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CON-${code}`;
}

// Unified Relative Path Resolver for Root vs Pages Directory
function resolveAppPath(target) {
  const isInsidePages = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');
  if (isInsidePages) {
    if (target.startsWith('pages/')) {
      return target.replace('pages/', '');
    } else {
      return '../' + target;
    }
  } else {
    return target;
  }
}

function redirectToLogin(role) {
  let target = 'login.html';
  if (role === 'vendor') {
    target = 'vendor-login.html';
  } else if (role === 'conductor') {
    target = 'conductor-login.html';
  }
  window.location.replace(resolveAppPath(target));
}

// Session State Management (Sync & Cross-Tab Safe)
function establishUserSession(role, uid) {
  try {
    sessionStorage.setItem('bp_session_active', 'true');
    sessionStorage.setItem('bp_user_role', role);
    if (uid) sessionStorage.setItem('bp_user_uid', uid);
    sessionStorage.removeItem('bp_logged_out');

    localStorage.setItem('bp_session_active', 'true');
    localStorage.setItem('bp_user_role', role);
    if (uid) localStorage.setItem('bp_user_uid', uid);
    localStorage.removeItem('bp_logged_out');
  } catch (e) {}
}

function terminateUserSession() {
  try {
    sessionStorage.removeItem('bp_session_active');
    sessionStorage.removeItem('bp_user_role');
    sessionStorage.removeItem('bp_user_uid');
    sessionStorage.setItem('bp_logged_out', 'true');

    localStorage.removeItem('bp_session_active');
    localStorage.removeItem('bp_user_role');
    localStorage.removeItem('bp_user_uid');
    localStorage.setItem('bp_logged_out', 'true');
  } catch (e) {}
}

function isExplicitlyLoggedOut() {
  try {
    return sessionStorage.getItem('bp_logged_out') === 'true' || 
           localStorage.getItem('bp_logged_out') === 'true';
  } catch (e) {
    return false;
  }
}

function isSessionLoggedOut() {
  return isExplicitlyLoggedOut();
}

function isCurrentPageProtected() {
  const path = (window.location.pathname || window.location.href).toLowerCase();
  if (path.includes('/pages/')) return true;
  if (path.includes('conductor-dashboard.html')) return true;
  if (path.includes('vendor-') && !path.includes('vendor-login') && !path.includes('vendor-register')) return true;
  return false;
}

// Immediate execution on script parse:
// If on a protected page and user has explicitly logged out, immediately hide page and redirect!
if (isCurrentPageProtected() && isExplicitlyLoggedOut()) {
  document.documentElement.style.display = 'none';
  let initialRole = 'student';
  const currentPath = (window.location.pathname || window.location.href).toLowerCase();
  if (currentPath.includes('conductor')) initialRole = 'conductor';
  else if (currentPath.includes('vendor')) initialRole = 'vendor';
  redirectToLogin(initialRole);
}

// BFCache (Back-Forward Cache) Guard:
// When Chrome navigates back into a protected page after logout,
// Chrome fires pageshow. This listener ensures the cached page is instantly wiped and replaced.
window.addEventListener('pageshow', function (event) {
  if (isCurrentPageProtected() && isExplicitlyLoggedOut()) {
    document.documentElement.style.display = 'none';
    let targetRole = window._expectedRole || 'student';
    const currentPath = (window.location.pathname || window.location.href).toLowerCase();
    if (currentPath.includes('conductor')) targetRole = 'conductor';
    else if (currentPath.includes('vendor')) targetRole = 'vendor';
    if (typeof auth !== 'undefined' && auth.signOut) {
      auth.signOut().catch(() => {});
    }
    redirectToLogin(targetRole);
  }
});

// Popstate guard for history back navigation
window.addEventListener('popstate', function () {
  if (isCurrentPageProtected() && isExplicitlyLoggedOut()) {
    document.documentElement.style.display = 'none';
    let targetRole = window._expectedRole || 'student';
    redirectToLogin(targetRole);
  }
});

// Cross-tab synchronization: If user logs out in another tab, terminate session immediately
window.addEventListener('storage', function (e) {
  if (e.key === 'bp_logged_out') {
    if (isCurrentPageProtected() && isExplicitlyLoggedOut()) {
      document.documentElement.style.display = 'none';
      let targetRole = window._expectedRole || 'student';
      redirectToLogin(targetRole);
    }
  }
});

// Vendor Registration
async function registerVendor(name, email, password, phone, businessName = '') {
  try {
    const cleanName = (name || '').trim();
    if (!cleanName || !/^[A-Za-z\s]+$/.test(cleanName)) {
      throw new Error("Operator name must contain only letters and spaces (no numbers or special characters).");
    }

    const cleanPhone = (phone || '').toString().trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      throw new Error("Mobile number must be exactly 10 digits.");
    }

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const uid = user.uid;

    const vendorData = {
      uid: uid,
      name: cleanName,
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      businessName: businessName.trim(),
      role: 'vendor',
      emailVerified: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(vendorData);

    // Send official verification email via Firebase Auth
    try {
      await user.sendEmailVerification();
    } catch (verErr) {
      console.warn("Failed to dispatch initial verification email:", verErr);
    }

    // Sign out immediately so unverified account cannot bypass authentication
    await auth.signOut();
    terminateUserSession();

    return { 
      user: user, 
      userData: vendorData, 
      emailVerificationSent: true 
    };
  } catch (error) {
    console.error("Vendor registration error:", error);
    throw error;
  }
}

// Vendor Login
async function loginVendor(email, password) {
  try {
    sessionStorage.removeItem('bp_logged_out');
    localStorage.removeItem('bp_logged_out');

    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const uid = user.uid;

    // Strict Email Verification Check
    if (!user.emailVerified) {
      await auth.signOut();
      terminateUserSession();
      const verifyErr = new Error("Email verification required. Please click the activation link sent to " + email + ".");
      verifyErr.code = 'auth/email-not-verified';
      verifyErr.unverifiedEmail = email;
      throw verifyErr;
    }

    establishUserSession('vendor', uid);

    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'vendor') {
      await auth.signOut();
      terminateUserSession();
      throw new Error("Access denied: Not registered as a Transport Vendor.");
    }

    return { user: userCredential.user, userData: userDoc.data() };
  } catch (error) {
    console.error("Vendor login error:", error);
    throw error;
  }
}

// Student Registration
async function registerStudent(name, email, password, phone) {
  try {
    const cleanName = (name || '').trim();
    if (!cleanName || !/^[A-Za-z\s]+$/.test(cleanName)) {
      throw new Error("Student name must contain only letters and spaces (no numbers or special characters).");
    }

    const cleanPhone = (phone || '').toString().trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      throw new Error("Mobile number must be exactly 10 digits.");
    }

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const uid = user.uid;

    const studentData = {
      uid: uid,
      name: cleanName,
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      role: 'student',
      emailVerified: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(studentData);

    // Send official verification email via Firebase Auth
    try {
      await user.sendEmailVerification();
    } catch (verErr) {
      console.warn("Failed to dispatch initial verification email:", verErr);
    }

    // Sign out immediately so unverified account cannot bypass authentication
    await auth.signOut();
    terminateUserSession();

    return { 
      user: user, 
      userData: studentData, 
      emailVerificationSent: true 
    };
  } catch (error) {
    console.error("Student registration error:", error);
    throw error;
  }
}

// Student Login
async function loginStudent(email, password) {
  try {
    sessionStorage.removeItem('bp_logged_out');
    localStorage.removeItem('bp_logged_out');

    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const uid = user.uid;

    // Strict Email Verification Check
    if (!user.emailVerified) {
      await auth.signOut();
      terminateUserSession();
      const verifyErr = new Error("Email verification required. Please click the activation link sent to " + email + ".");
      verifyErr.code = 'auth/email-not-verified';
      verifyErr.unverifiedEmail = email;
      throw verifyErr;
    }

    establishUserSession('student', uid);

    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'student') {
      await auth.signOut();
      terminateUserSession();
      throw new Error("Access denied: Not registered as a Student.");
    }

    return { user: userCredential.user, userData: userDoc.data() };
  } catch (error) {
    console.error("Student login error:", error);
    throw error;
  }
}

/**
 * Resends verification email to an unverified user
 */
async function resendVerificationEmail(email, password) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    if (cred.user.emailVerified) {
      await auth.signOut();
      terminateUserSession();
      throw new Error("This email is already verified! You can log in directly.");
    }
    await cred.user.sendEmailVerification();
    await auth.signOut();
    terminateUserSession();
    return true;
  } catch (error) {
    console.error("Resend verification error:", error);
    let msg = error.message;
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      msg = "Incorrect password. Please enter your valid password to resend the verification email.";
    } else if (error.code === 'auth/too-many-requests') {
      msg = "Too many attempts. Please wait a moment before trying again.";
    }
    throw new Error(msg);
  }
}

/**
 * Vendor Password Reset
 * Strictly verifies account possesses role 'vendor' in Firestore before dispatching reset email.
 * If live Firestore cloud rules restrict unauthenticated queries, falls back directly to Auth
 * to ensure valid users are never blocked by permission errors.
 */
async function sendVendorPasswordReset(email) {
  try {
    const rawEmail = (email || '').trim();
    const cleanEmail = rawEmail.toLowerCase();
    if (!cleanEmail) throw new Error("Please enter your registered vendor email address.");

    try {
      let snap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (snap.empty && rawEmail !== cleanEmail) {
        snap = await db.collection('users').where('email', '==', rawEmail).limit(1).get();
      }

      if (!snap.empty) {
        const userData = snap.docs[0].data();
        if (userData.role && userData.role !== 'vendor') {
          throw new Error("Access Denied: This email does not belong to a Vendor account.");
        }
        if (userData.status === 'Suspended') {
          throw new Error("This vendor account has been suspended. Please contact master administration.");
        }
      } else {
        throw new Error("No vendor account found with this email address.");
      }
    } catch (checkErr) {
      if (checkErr.message && (
        checkErr.message.startsWith('Access Denied') ||
        checkErr.message.includes('suspended') ||
        checkErr.message.startsWith('No vendor account')
      )) {
        throw checkErr;
      }
      console.warn("Firestore unauthenticated query restricted by security rules. Proceeding via Firebase Auth:", checkErr);
    }

    await auth.sendPasswordResetEmail(cleanEmail);
    return true;
  } catch (error) {
    console.error("Vendor password reset error:", error);
    let msg = error.message;
    if (error.code === 'auth/user-not-found') {
      msg = "No vendor account found with this email address in authentication.";
    } else if (error.code === 'auth/invalid-email') {
      msg = "Please enter a valid email address.";
    } else if (error.code === 'auth/too-many-requests') {
      msg = "Too many reset attempts. Please wait a moment and try again.";
    }
    throw new Error(msg);
  }
}

/**
 * Student Password Reset
 * Strictly verifies account possesses role 'student' in Firestore before dispatching reset email.
 * If live Firestore cloud rules restrict unauthenticated queries, falls back directly to Auth
 * to ensure valid users are never blocked by permission errors.
 */
async function sendStudentPasswordReset(email) {
  try {
    const rawEmail = (email || '').trim();
    const cleanEmail = rawEmail.toLowerCase();
    if (!cleanEmail) throw new Error("Please enter your registered student email address.");

    try {
      let snap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (snap.empty && rawEmail !== cleanEmail) {
        snap = await db.collection('users').where('email', '==', rawEmail).limit(1).get();
      }

      if (!snap.empty) {
        const userData = snap.docs[0].data();
        if (userData.role && userData.role !== 'student') {
          throw new Error("Access Denied: This email does not belong to a Student account.");
        }
        if (userData.status === 'Suspended') {
          throw new Error("This student account has been suspended. Please contact campus administration.");
        }
      } else {
        throw new Error("No student account found with this email address.");
      }
    } catch (checkErr) {
      if (checkErr.message && (
        checkErr.message.startsWith('Access Denied') ||
        checkErr.message.includes('suspended') ||
        checkErr.message.startsWith('No student account')
      )) {
        throw checkErr;
      }
      console.warn("Firestore unauthenticated query restricted by security rules. Proceeding via Firebase Auth:", checkErr);
    }

    await auth.sendPasswordResetEmail(cleanEmail);
    return true;
  } catch (error) {
    console.error("Student password reset error:", error);
    let msg = error.message;
    if (error.code === 'auth/user-not-found') {
      msg = "No student account found with this email address in authentication.";
    } else if (error.code === 'auth/invalid-email') {
      msg = "Please enter a valid email address.";
    } else if (error.code === 'auth/too-many-requests') {
      msg = "Too many reset attempts. Please wait a moment and try again.";
    }
    throw new Error(msg);
  }
}

// Conductor Login using Conductor ID & Password (No email typed)
async function loginConductor(conductorId, password) {
  try {
    sessionStorage.removeItem('bp_logged_out');
    localStorage.removeItem('bp_logged_out');

    let cleanId = conductorId.trim().toUpperCase().replace(/\s+/g, '');
    
    // Auto-normalize if user typed ID without 'CON-' prefix (e.g., '7F42A9')
    let candidateIds = [cleanId];
    if (!cleanId.startsWith('CON-') && !cleanId.includes('@')) {
      candidateIds.unshift(`CON-${cleanId}`); // Try with CON- first
    }

    let userCredential = null;
    let authError = null;

    // Candidate synthetic emails: base ID first, then versioned aliases (e.g. CON-XXXXXX.v2)
    let candidateEmails = [];
    for (const testId of candidateIds) {
      candidateEmails.push(`${testId}${AUTH_INTERNAL_DOMAIN}`);
      for (let v = 2; v <= 10; v++) {
        candidateEmails.push(`${testId}.v${v}${AUTH_INTERNAL_DOMAIN}`);
      }
    }

    for (const testEmail of candidateEmails) {
      try {
        userCredential = await auth.signInWithEmailAndPassword(testEmail, password);
        break;
      } catch (err) {
        authError = err;
      }
    }

    if (!userCredential) {
      console.error("Conductor auth error:", authError);
      if (authError && (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password')) {
        throw new Error("Invalid Conductor ID or Password. Ensure you entered your official Conductor ID (e.g. CON-XXXXXX) issued by your Transport Admin.");
      }
      throw authError || new Error("Failed to authenticate conductor.");
    }

    const uid = userCredential.user.uid;
    establishUserSession('conductor', uid);

    let userDoc = await db.collection('users').doc(uid).get();
    let userData = userDoc.exists ? userDoc.data() : null;

    // Self-healing fallback: If users collection record is missing, recover from conductors collection
    if (!userData || userData.role !== 'conductor') {
      let condSnap = await db.collection('conductors').where('uid', '==', uid).get();
      if (condSnap.empty) {
        for (const testId of candidateIds) {
          condSnap = await db.collection('conductors').where('conductorId', '==', testId).get();
          if (!condSnap.empty) break;
        }
      }
      if (!condSnap.empty) {
        const cData = condSnap.docs[0].data();
        userData = {
          uid: uid,
          conductorDocId: condSnap.docs[0].id,
          conductorId: cData.conductorId || cleanId,
          name: cData.name || 'Conductor',
          phone: cData.phone || '',
          role: 'conductor',
          vendorId: cData.vendorId || '',
          organizationId: cData.organizationId || '',
          busId: cData.busId || ''
        };

        // Self-heal: Since conductor is authenticated, create users doc now
        try {
          await db.collection('users').doc(uid).set({
            ...userData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (healErr) {
          console.warn("Could not write self-healing user doc:", healErr);
        }
      } else {
        await auth.signOut();
        terminateUserSession();
        throw new Error("Access denied: This account is not registered as an authorized Conductor.");
      }
    }

    return { user: userCredential.user, userData: userData };
  } catch (error) {
    console.error("Conductor login error:", error);
    throw error;
  }
}

/**
 * Creates Conductor Account by Vendor.
 * Uses secondary Firebase Auth instance so the Vendor remains logged in!
 */
async function createConductorAccount(conductorData, password) {
  const cleanPhone = (conductorData.phone || '').toString().trim().replace(/[^0-9]/g, '');
  if (conductorData.phone && cleanPhone.length !== 10) {
    throw new Error("Conductor mobile number must be exactly 10 digits.");
  }
  conductorData.phone = cleanPhone;

  const secondaryApp = getSecondaryApp();
  const secondaryAuth = secondaryApp.auth();
  const conductorId = (conductorData.conductorId || generateConductorId()).toUpperCase().trim();
  const syntheticEmail = `${conductorId}${AUTH_INTERNAL_DOMAIN}`;

  try {
    // 1. Create auth user in secondary instance
    const credential = await secondaryAuth.createUserWithEmailAndPassword(syntheticEmail, password);
    const conductorUid = credential.user.uid;

    // 2. Prepare Firestore docs
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const fullConductorRecord = {
      uid: conductorUid,
      conductorId: conductorId,
      vendorId: conductorData.vendorId,
      organizationId: conductorData.organizationId,
      organizationName: conductorData.organizationName || '',
      busId: conductorData.busId || '',
      busNumber: conductorData.busNumber || 'Unassigned',
      registrationNumber: conductorData.registrationNumber || '',
      routeId: conductorData.routeId || '',
      routeName: conductorData.routeName || 'Unassigned',
      name: conductorData.name.trim(),
      employeeId: conductorData.employeeId.trim(),
      phone: conductorData.phone.trim(),
      role: 'conductor',
      status: 'Active',
      dutyPassword: password, // Saved so Vendor can view/manage credentials
      createdAt: now,
      updatedAt: now
    };

    // Store in conductors collection (using primary db where Vendor is authenticated)
    const conductorRef = await db.collection('conductors').add(fullConductorRecord);

    const userProfileData = {
      uid: conductorUid,
      conductorDocId: conductorRef.id,
      conductorId: conductorId,
      name: conductorData.name.trim(),
      phone: conductorData.phone.trim(),
      role: 'conductor',
      vendorId: conductorData.vendorId,
      organizationId: conductorData.organizationId,
      busId: conductorData.busId || '',
      createdAt: now
    };

    // Attempt to write users doc while conductor is authenticated on secondaryApp
    try {
      const secondaryDb = secondaryApp.firestore();
      await secondaryDb.collection('users').doc(conductorUid).set(userProfileData);
    } catch (secErr) {
      // Fallback: write using primary db
      try {
        await db.collection('users').doc(conductorUid).set(userProfileData);
      } catch (primErr) {
        console.warn("Could not write users doc immediately; will self-heal upon first login:", primErr);
      }
    }

    // Immediately sign out secondary auth so it doesn't linger
    await secondaryAuth.signOut();

    return {
      conductorDocId: conductorRef.id,
      conductorId: conductorId,
      uid: conductorUid
    };
  } catch (error) {
    console.error("Error creating conductor account:", error);
    try { await secondaryAuth.signOut(); } catch (e) {}
    throw error;
  }
}

/**
 * Vendor changes/resets a Conductor's duty password.
 * - If the current password is known or matches, it updates in Firebase Auth in-place.
 * - If the current password is forgotten or unknown, it seamlessly provisions the new password
 *   under an internal alias so the conductor can immediately log in with their unchanged Conductor ID.
 * - Always keeps dutyPassword updated in Firestore so the Vendor can view it anytime!
 */
async function updateConductorPassword(conductorDocId, conductorId, currentPassword, newPassword) {
  const secondaryApp = getSecondaryApp();
  const secondaryAuth = secondaryApp.auth();
  const cleanId = conductorId.trim().toUpperCase();
  const syntheticEmail = `${cleanId}${AUTH_INTERNAL_DOMAIN}`;

  // Candidates for previous/current password to try
  const candidates = [
    currentPassword,
    'Duty@123',
    'Conductor@123',
    '123456',
    `${cleanId}@123`
  ].filter(Boolean);

  let updatedInPlace = false;

  // 1. Try to sign in with candidate passwords and update in place on base email
  for (const pass of candidates) {
    try {
      const credential = await secondaryAuth.signInWithEmailAndPassword(syntheticEmail, pass);
      await credential.user.updatePassword(newPassword);
      await secondaryAuth.signOut();
      updatedInPlace = true;
      break;
    } catch (err) {
      try { await secondaryAuth.signOut(); } catch (e) {}
    }
  }

  // Also check existing versioned aliases if base email didn't match
  if (!updatedInPlace) {
    for (let v = 2; v <= 10; v++) {
      const aliasEmail = `${cleanId}.v${v}${AUTH_INTERNAL_DOMAIN}`;
      for (const pass of candidates) {
        try {
          const credential = await secondaryAuth.signInWithEmailAndPassword(aliasEmail, pass);
          await credential.user.updatePassword(newPassword);
          await secondaryAuth.signOut();
          updatedInPlace = true;
          break;
        } catch (err) {
          try { await secondaryAuth.signOut(); } catch (e) {}
        }
      }
      if (updatedInPlace) break;
    }
  }

  // 2. If current password was completely forgotten/unknown and could not sign in:
  // Create a fresh auth identity under the next available versioned alias
  let newConductorUid = null;
  let activeAuthEmail = syntheticEmail;

  if (!updatedInPlace) {
    let created = false;
    for (let v = 2; v <= 15; v++) {
      const aliasEmail = `${cleanId}.v${v}${AUTH_INTERNAL_DOMAIN}`;
      try {
        const cred = await secondaryAuth.createUserWithEmailAndPassword(aliasEmail, newPassword);
        newConductorUid = cred.user.uid;
        activeAuthEmail = aliasEmail;
        await secondaryAuth.signOut();
        created = true;
        break;
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          try {
            const existingCred = await secondaryAuth.signInWithEmailAndPassword(aliasEmail, newPassword);
            newConductorUid = existingCred.user.uid;
            activeAuthEmail = aliasEmail;
            await secondaryAuth.signOut();
            created = true;
            break;
          } catch (e) {
            try { await secondaryAuth.signOut(); } catch (ign) {}
            continue;
          }
        }
      }
    }

    if (!created) {
      throw new Error("Unable to reset password automatically. Please try again or create a new conductor account.");
    }
  }

  // 3. Update the conductor's document in Firestore
  const updateData = {
    dutyPassword: newPassword,
    activeAuthEmail: activeAuthEmail,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (newConductorUid) {
    updateData.uid = newConductorUid;
  }

  await db.collection('conductors').doc(conductorDocId).update(updateData);

  // 4. Update or ensure users collection has the conductor profile
  if (newConductorUid) {
    try {
      const condDoc = await db.collection('conductors').doc(conductorDocId).get();
      const cData = condDoc.data() || {};
      await db.collection('users').doc(newConductorUid).set({
        uid: newConductorUid,
        conductorDocId: conductorDocId,
        conductorId: cleanId,
        name: cData.name || 'Conductor',
        phone: cData.phone || '',
        role: 'conductor',
        vendorId: cData.vendorId || '',
        organizationId: cData.organizationId || '',
        busId: cData.busId || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (uErr) {
      console.warn("Could not sync users doc after alias password reset:", uErr);
    }
  }

  return true;
}

// Unified Logout
async function logoutUser() {
  try {
    // 1. Immediately terminate local & session storage
    terminateUserSession();

    // 2. Sign out of Firebase Auth
    if (typeof auth !== 'undefined' && auth.signOut) {
      await auth.signOut();
    }
  } catch (error) {
    console.error("Logout error:", error);
    terminateUserSession();
  } finally {
    // 3. Immediately hide document content to prevent any snapshot from showing on back/forward
    document.documentElement.style.display = 'none';

    // 4. Force replace current URL so user cannot press Back into this page
    window.location.replace(resolveAppPath('index.html'));
  }
}

/**
 * Route Guard / Auth Checker
 * Validates session, checks role, updates UI navbar and executes onReady callback
 */
function requireAuth(expectedRole, onReady) {
  window._isProtectedPage = true;
  window._expectedRole = expectedRole;

  // 1. Instant Synchronous Check
  if (isExplicitlyLoggedOut()) {
    document.documentElement.style.display = 'none';
    if (typeof auth !== 'undefined' && auth.signOut) {
      auth.signOut().catch(() => {});
    }
    redirectToLogin(expectedRole);
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user || isExplicitlyLoggedOut()) {
      terminateUserSession();
      document.documentElement.style.display = 'none';
      redirectToLogin(expectedRole);
      return;
    }

    try {
      let userDoc = await db.collection('users').doc(user.uid).get();
      let userData = userDoc.exists ? userDoc.data() : null;

      // Conductor fallback & self-heal if users collection doc is missing
      if (!userData && expectedRole === 'conductor') {
        const condSnap = await db.collection('conductors').where('uid', '==', user.uid).get();
        if (!condSnap.empty) {
          const cData = condSnap.docs[0].data();
          userData = {
            uid: user.uid,
            conductorDocId: condSnap.docs[0].id,
            conductorId: cData.conductorId,
            name: cData.name || 'Conductor',
            phone: cData.phone || '',
            role: 'conductor',
            vendorId: cData.vendorId || '',
            organizationId: cData.organizationId || '',
            busId: cData.busId || '',
            ...cData
          };
          try {
            await db.collection('users').doc(user.uid).set({
              uid: user.uid,
              conductorDocId: condSnap.docs[0].id,
              conductorId: cData.conductorId,
              name: cData.name || 'Conductor',
              phone: cData.phone || '',
              role: 'conductor',
              vendorId: cData.vendorId || '',
              organizationId: cData.organizationId || '',
              busId: cData.busId || '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (healErr) {}
        }
      }

      if (!userData) {
        terminateUserSession();
        await auth.signOut();
        document.documentElement.style.display = 'none';
        redirectToLogin(expectedRole);
        return;
      }

      // Check email verification for students and vendors
      if ((userData.role === 'student' || userData.role === 'vendor') && !user.emailVerified) {
        console.warn("Unverified email access attempted. Redirecting to login.");
        terminateUserSession();
        await auth.signOut();
        document.documentElement.style.display = 'none';
        const targetLogin = userData.role === 'vendor' ? 'vendor-login.html?unverified=true' : 'login.html?unverified=true';
        window.location.replace(resolveAppPath(targetLogin));
        return;
      }

      // Check role enforcement
      if (expectedRole && userData.role !== expectedRole) {
        console.warn(`Role mismatch: Expected ${expectedRole}, got ${userData.role}`);
        // Redirect to appropriate dashboard using replace
        if (userData.role === 'vendor') window.location.replace(resolveAppPath('vendor-dashboard.html'));
        else if (userData.role === 'student') window.location.replace(resolveAppPath('pages/student-dashboard.html'));
        else if (userData.role === 'conductor') window.location.replace(resolveAppPath('conductor-dashboard.html'));
        else if (userData.role === 'superadmin') window.location.replace(resolveAppPath('admin-dashboard.html'));
        else window.location.replace(resolveAppPath('index.html'));
        return;
      }

      // Ensure session is marked active
      establishUserSession(userData.role, user.uid);

      // Populate user info in layout if elements exist
      updateLayoutUserInfo(userData);

      if (typeof onReady === 'function') {
        onReady(user, userData);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      showToast("Authentication check failed. Please refresh.", "danger");
    }
  });
}

function updateLayoutUserInfo(userData) {
  const userNameEls = document.querySelectorAll('.sidebar-user-name, .topbar-user-name');
  const userRoleEls = document.querySelectorAll('.sidebar-user-role');
  const userAvatarEls = document.querySelectorAll('.sidebar-user-avatar, .topbar-user-pill .avatar');

  userNameEls.forEach(el => el.textContent = userData.name || 'User');
  userRoleEls.forEach(el => el.textContent = userData.role || 'Member');

  const initial = (userData.name || 'U').charAt(0).toUpperCase();
  userAvatarEls.forEach(el => el.textContent = initial);
}

/**
 * Deletes a Conductor completely from the Firestore database (both conductors and users collections)
 * and attempts to delete their Firebase Authentication identity via secondaryAuth.
 */
async function deleteConductorAccount(conductorDocId, conductorId, conductorUid, dutyPassword = '') {
  try {
    // 1. Delete from conductors collection
    if (conductorDocId) {
      await db.collection('conductors').doc(conductorDocId).delete().catch(e => console.warn("Conductor doc delete error:", e));
    }

    // 2. Delete from users collection (by UID and by conductorId query)
    if (conductorUid) {
      await db.collection('users').doc(conductorUid).delete().catch(e => console.warn("Users doc delete error:", e));
    }
    if (conductorId) {
      const uSnap = await db.collection('users').where('conductorId', '==', conductorId).get().catch(() => null);
      if (uSnap && !uSnap.empty) {
        for (const doc of uSnap.docs) {
          await doc.ref.delete().catch(() => {});
        }
      }
    }

    // 3. Try deleting from Firebase Auth via secondaryAuth if dutyPassword is known
    if (conductorId && dutyPassword) {
      try {
        const secondaryApp = getSecondaryApp();
        const secondaryAuth = secondaryApp.auth();
        const cleanId = conductorId.trim().toUpperCase();
        const candidates = [
          `${cleanId}${AUTH_INTERNAL_DOMAIN}`,
          `${cleanId}.v2${AUTH_INTERNAL_DOMAIN}`,
          `${cleanId}.v3${AUTH_INTERNAL_DOMAIN}`
        ];
        for (const testEmail of candidates) {
          try {
            const cred = await secondaryAuth.signInWithEmailAndPassword(testEmail, dutyPassword);
            await cred.user.delete();
            await secondaryAuth.signOut();
            break;
          } catch (e) {
            try { await secondaryAuth.signOut(); } catch (ign) {}
          }
        }
      } catch (authErr) {
        console.warn("Secondary auth user delete warning (conductor record in Firestore was already deleted):", authErr);
      }
    }

    return true;
  } catch (err) {
    console.error("Error in deleteConductorAccount:", err);
    throw err;
  }
}

/**
 * Deletes a Student's account from Firestore (users, applications, passes, notifications)
 * and permanently deletes their Firebase Auth account.
 */
async function deleteCurrentStudentAccount(password = null) {
  const user = auth.currentUser;
  if (!user) throw new Error("No active authenticated session found.");
  const uid = user.uid;

  // Re-authenticate if password is provided (prevents auth/requires-recent-login failure)
  if (password && user.email) {
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
      await user.reauthenticateWithCredential(credential);
    } catch (reauthErr) {
      if (reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential') {
        throw new Error("Incorrect current password. Please enter your valid password to authorize deletion.");
      }
      throw reauthErr;
    }
  }

  // 1. Delete student Firestore records
  try {
    // Passes
    const passSnap = await db.collection('passes').where('studentId', '==', uid).get().catch(() => null);
    if (passSnap && !passSnap.empty) {
      for (const d of passSnap.docs) await d.ref.delete().catch(() => {});
    }

    // Applications
    const appSnap = await db.collection('applications').where('studentId', '==', uid).get().catch(() => null);
    if (appSnap && !appSnap.empty) {
      for (const d of appSnap.docs) await d.ref.delete().catch(() => {});
    }

    // Notifications
    const notifSnap = await db.collection('notifications').where('userId', '==', uid).get().catch(() => null);
    if (notifSnap && !notifSnap.empty) {
      for (const d of notifSnap.docs) await d.ref.delete().catch(() => {});
    }

    // User doc in users collection
    await db.collection('users').doc(uid).delete().catch(err => console.warn("User doc delete warning:", err));
  } catch (dbErr) {
    console.warn("Firestore cleanup warning:", dbErr);
  }

  // 2. Delete Firebase Authentication user
  try {
    await user.delete();
  } catch (delErr) {
    if (delErr.code === 'auth/requires-recent-login') {
      throw new Error("AUTH_REQUIRES_RECENT_LOGIN");
    }
    throw delErr;
  }

  // 3. Terminate session and redirect to home
  terminateUserSession();
  document.documentElement.style.display = 'none';
  window.location.replace(resolveAppPath('index.html'));
  return true;
}

/**
 * Deletes a Vendor's entire business account and all associated operational records
 * (organizations, routes, buses, conductors, live bus locations, applications, passes, users doc)
 * and permanently deletes their Firebase Auth account.
 */
async function deleteCurrentVendorAccount(password = null) {
  const user = auth.currentUser;
  if (!user) throw new Error("No active authenticated session found.");
  const uid = user.uid;

  // Re-authenticate if password is provided
  if (password && user.email) {
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
      await user.reauthenticateWithCredential(credential);
    } catch (reauthErr) {
      if (reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential') {
        throw new Error("Incorrect current password. Please enter your valid password to authorize deletion.");
      }
      throw reauthErr;
    }
  }

  // 1. Delete all associated vendor Firestore records
  try {
    // Collect all organizations owned by this vendor
    const orgSnap = await db.collection('organizations').where('vendorId', '==', uid).get().catch(() => null);
    const orgIds = [];
    if (orgSnap && !orgSnap.empty) {
      orgSnap.docs.forEach(d => orgIds.push(d.id));
    }

    // Collect and delete routes (by vendorId AND by organizationId)
    const routeDocMap = new Map();
    const routeSnap = await db.collection('routes').where('vendorId', '==', uid).get().catch(() => null);
    if (routeSnap && !routeSnap.empty) {
      routeSnap.docs.forEach(d => routeDocMap.set(d.id, d));
    }
    for (const orgId of orgIds) {
      const rByOrg = await db.collection('routes').where('organizationId', '==', orgId).get().catch(() => null);
      if (rByOrg && !rByOrg.empty) {
        rByOrg.docs.forEach(d => routeDocMap.set(d.id, d));
      }
    }
    const routeIds = Array.from(routeDocMap.keys());

    // Collect and delete buses (by vendorId, organizationId, routeId)
    const busDocMap = new Map();
    const busSnap = await db.collection('buses').where('vendorId', '==', uid).get().catch(() => null);
    if (busSnap && !busSnap.empty) {
      busSnap.docs.forEach(d => busDocMap.set(d.id, d));
    }
    for (const orgId of orgIds) {
      const bByOrg = await db.collection('buses').where('organizationId', '==', orgId).get().catch(() => null);
      if (bByOrg && !bByOrg.empty) {
        bByOrg.docs.forEach(d => busDocMap.set(d.id, d));
      }
    }
    for (const rId of routeIds) {
      const bByRoute = await db.collection('buses').where('routeId', '==', rId).get().catch(() => null);
      if (bByRoute && !bByRoute.empty) {
        bByRoute.docs.forEach(d => busDocMap.set(d.id, d));
      }
    }

    // Delete Live Locations
    for (const busId of busDocMap.keys()) {
      await db.collection('liveBusLocations').doc(busId).delete().catch(() => {});
    }

    // Conductors
    const condDocMap = new Map();
    const condSnap = await db.collection('conductors').where('vendorId', '==', uid).get().catch(() => null);
    if (condSnap && !condSnap.empty) {
      condSnap.docs.forEach(d => condDocMap.set(d.id, d));
    }
    for (const orgId of orgIds) {
      const cByOrg = await db.collection('conductors').where('organizationId', '==', orgId).get().catch(() => null);
      if (cByOrg && !cByOrg.empty) {
        cByOrg.docs.forEach(d => condDocMap.set(d.id, d));
      }
    }

    for (const cDoc of condDocMap.values()) {
      const cData = cDoc.data();
      if (cData.uid) {
        await db.collection('users').doc(cData.uid).delete().catch(() => {});
      }
      await cDoc.ref.delete().catch(() => {});
    }

    // Delete Buses
    for (const bDoc of busDocMap.values()) {
      await bDoc.ref.delete().catch(() => {});
    }

    // Delete Routes
    for (const rDoc of routeDocMap.values()) {
      await rDoc.ref.delete().catch(() => {});
    }

    // Delete Organizations
    if (orgSnap && !orgSnap.empty) {
      for (const d of orgSnap.docs) await d.ref.delete().catch(() => {});
    }

    // Applications & Passes
    const appSnap = await db.collection('applications').where('vendorId', '==', uid).get().catch(() => null);
    if (appSnap && !appSnap.empty) {
      for (const d of appSnap.docs) await d.ref.delete().catch(() => {});
    }
    const passSnap = await db.collection('passes').where('vendorId', '==', uid).get().catch(() => null);
    if (passSnap && !passSnap.empty) {
      for (const d of passSnap.docs) await d.ref.delete().catch(() => {});
    }

    // Boarding Records
    const bSnap = await db.collection('boardingRecords').where('vendorId', '==', uid).get().catch(() => null);
    if (bSnap && !bSnap.empty) {
      for (const d of bSnap.docs) await d.ref.delete().catch(() => {});
    }

    // Notifications
    const notifSnap = await db.collection('notifications').where('userId', '==', uid).get().catch(() => null);
    if (notifSnap && !notifSnap.empty) {
      for (const d of notifSnap.docs) await d.ref.delete().catch(() => {});
    }

    // Vendor doc in users collection
    await db.collection('users').doc(uid).delete().catch(err => console.warn("Vendor user doc delete warning:", err));
  } catch (dbErr) {
    console.warn("Vendor Firestore cleanup warning:", dbErr);
  }

  // 2. Delete Firebase Authentication user
  try {
    await user.delete();
  } catch (delErr) {
    if (delErr.code === 'auth/requires-recent-login') {
      throw new Error("AUTH_REQUIRES_RECENT_LOGIN");
    }
    throw delErr;
  }

  // 3. Terminate session and redirect to home
  terminateUserSession();
  document.documentElement.style.display = 'none';
  window.location.replace(resolveAppPath('index.html'));
  return true;
}
