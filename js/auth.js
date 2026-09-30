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
    return { user: userCredential.user, userData: vendorData };
  } catch (error) {
    console.error("Vendor registration error:", error);
    throw error;
  }
}

// Vendor Login
async function loginVendor(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'vendor') {
      await auth.signOut();
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
    return { user: userCredential.user, userData: studentData };
  } catch (error) {
    console.error("Student registration error:", error);
    throw error;
  }
}

// Student Login
async function loginStudent(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'student') {
      await auth.signOut();
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

// Unified Logout
async function logoutUser() {
  try {
    await auth.signOut();
    window.location.href = resolveAppPath('index.html');
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Error during logout", "danger");
  }
}

/**
 * Route Guard / Auth Checker
 * Validates session, checks role, updates UI navbar and executes onReady callback
 */
function requireAuth(expectedRole, onReady) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
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
        await auth.signOut();
        redirectToLogin(expectedRole);
        return;
      }

      // Check role enforcement
      if (expectedRole && userData.role !== expectedRole) {
        console.warn(`Role mismatch: Expected ${expectedRole}, got ${userData.role}`);
        // Redirect to appropriate dashboard
        if (userData.role === 'vendor') window.location.href = resolveAppPath('vendor-dashboard.html');
        else if (userData.role === 'student') window.location.href = resolveAppPath('pages/student-dashboard.html');
        else if (userData.role === 'conductor') window.location.href = resolveAppPath('conductor-dashboard.html');
        else window.location.href = resolveAppPath('index.html');
        return;
      }

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

function redirectToLogin(role) {
  if (role === 'vendor') {
    window.location.href = resolveAppPath('vendor-login.html');
  } else if (role === 'conductor') {
    window.location.href = resolveAppPath('conductor-login.html');
  } else {
    window.location.href = resolveAppPath('login.html');
  }
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
