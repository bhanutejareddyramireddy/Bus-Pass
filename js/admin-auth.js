/**
 * BUSPASS SUPER ADMIN DASHBOARD - AUTHENTICATION MODULE
 * Dedicated Super Admin login, session establishment, credential verification, and security controls
 */

/**
 * Super Admin Login
 * Validates credentials and verifies that the account possesses role 'superadmin' in Firestore
 */
async function loginSuperAdmin(email, password) {
  try {
    sessionStorage.removeItem('bp_admin_logged_out');
    localStorage.removeItem('bp_admin_logged_out');

    const cleanEmail = (email || '').trim().toLowerCase();
    const cred = await auth.signInWithEmailAndPassword(cleanEmail, password);
    const user = cred.user;

    // Check user document in Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    let userData;

    if (!userDoc.exists) {
      if (cleanEmail === 'admin@buspass.local' || cleanEmail === 'superadmin@buspass.local') {
        // Auto-provision primary administrator document on first successful login
        userData = {
          uid: user.uid,
          email: cleanEmail,
          name: "Super Administrator",
          role: "superadmin",
          status: "Active",
          mustChangePassword: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(user.uid).set(userData);
      } else {
        await auth.signOut();
        throw new Error("Administrator account record not found in system directory.");
      }
    } else {
      userData = userDoc.data();
    }

    // Verify Super Admin role
    if (userData.role !== 'superadmin') {
      await auth.signOut();
      throw new Error("Access Denied: This account is not registered as a Platform Super Administrator.");
    }

    // Check account status
    if (userData.status === 'Suspended') {
      await auth.signOut();
      throw new Error("Your administrator account is suspended. Contact system infrastructure team.");
    }

    // Establish admin session
    sessionStorage.setItem('bp_session_active', 'true');
    sessionStorage.setItem('bp_user_role', 'superadmin');
    sessionStorage.setItem('bp_admin_session', 'true');
    sessionStorage.setItem('bp_admin_uid', user.uid);
    sessionStorage.setItem('bp_admin_email', user.email);

    localStorage.setItem('bp_session_active', 'true');
    localStorage.setItem('bp_user_role', 'superadmin');
    localStorage.setItem('bp_admin_session', 'true');
    localStorage.setItem('bp_admin_uid', user.uid);
    localStorage.setItem('bp_admin_email', user.email);

    // Record login audit log
    try {
      await db.collection('auditLogs').add({
        actorUid: user.uid,
        actorEmail: user.email,
        actorRole: 'superadmin',
        action: 'SUPER_ADMIN_LOGIN',
        targetType: 'system',
        targetId: user.uid,
        targetName: userData.name || user.email,
        details: { userAgent: navigator.userAgent },
        reason: 'Authorized administrator portal sign in',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (auditErr) {
      console.warn("Audit record notice:", auditErr);
    }

    return {
      user: user,
      userData: userData,
      mustChangePassword: Boolean(userData.mustChangePassword)
    };

  } catch (error) {
    console.error("Super Admin login error:", error);
    let msg = error.message;
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      msg = "Invalid Super Admin credentials. Please check your email and password.";
    } else if (error.code === 'auth/too-many-requests') {
      msg = "Too many failed attempts. Account temporarily locked for security. Try again in a few minutes.";
    }
    throw new Error(msg);
  }
}

/**
 * Super Admin Password Reset
 */
async function sendAdminPasswordReset(email) {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error("Please enter your registered administrator email.");
    await auth.sendPasswordResetEmail(cleanEmail);
    return true;
  } catch (error) {
    console.error("Admin password reset error:", error);
    let msg = error.message;
    if (error.code === 'auth/user-not-found') {
      msg = "No administrator account found with this email.";
    }
    throw new Error(msg);
  }
}
