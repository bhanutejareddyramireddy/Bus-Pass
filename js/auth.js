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
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    const vendorData = {
      uid: uid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      businessName: businessName.trim(),
      role: 'vendor',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(vendorData);
    establishUserSession('vendor', uid);
    return { user: userCredential.user, userData: vendorData };
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
    const uid = userCredential.user.uid;

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
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    const studentData = {
      uid: uid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: 'student',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(studentData);
    establishUserSession('student', uid);
    return { user: userCredential.user, userData: studentData };
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
    const uid = userCredential.user.uid;

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

    for (const testId of candidateIds) {
      const syntheticEmail = `${testId}${AUTH_INTERNAL_DOMAIN}`;
      try {
        userCredential = await auth.signInWithEmailAndPassword(syntheticEmail, password);
        cleanId = testId;
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
      const condSnap = await db.collection('conductors').where('uid', '==', uid).get();
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
 * Uses secondary Firebase Auth instance to authenticate as the conductor,
 * update the password on Firebase Authentication servers,
 * and update the dutyPassword field in Firestore.
 */
async function updateConductorPassword(conductorDocId, conductorId, currentPassword, newPassword) {
  const secondaryApp = getSecondaryApp();
  const secondaryAuth = secondaryApp.auth();
  const cleanId = conductorId.trim().toUpperCase();
  const syntheticEmail = `${cleanId}${AUTH_INTERNAL_DOMAIN}`;

  try {
    // 1. Sign in to secondaryAuth with current password
    const credential = await secondaryAuth.signInWithEmailAndPassword(syntheticEmail, currentPassword);

    // 2. Update password in Firebase Auth servers
    await credential.user.updatePassword(newPassword);

    // 3. Immediately sign out secondary auth
    await secondaryAuth.signOut();

    // 4. Update conductors collection document with new password
    await db.collection('conductors').doc(conductorDocId).update({
      dutyPassword: newPassword,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return true;
  } catch (err) {
    console.error("Error updating conductor password:", err);
    try { await secondaryAuth.signOut(); } catch (e) {}
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error("Current password did not match the account password. Please re-enter the correct current password.");
    } else if (err.code === 'auth/weak-password') {
      throw new Error("New password is too weak. Please enter at least 6 characters.");
    }
    throw err;
  }
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

      // Check role enforcement
      if (expectedRole && userData.role !== expectedRole) {
        console.warn(`Role mismatch: Expected ${expectedRole}, got ${userData.role}`);
        // Redirect to appropriate dashboard using replace
        if (userData.role === 'vendor') window.location.replace(resolveAppPath('vendor-dashboard.html'));
        else if (userData.role === 'student') window.location.replace(resolveAppPath('pages/student-dashboard.html'));
        else if (userData.role === 'conductor') window.location.replace(resolveAppPath('conductor-dashboard.html'));
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
