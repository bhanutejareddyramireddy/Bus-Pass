const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const AUTH_INTERNAL_DOMAIN = "@buspass.internal";

/**
 * Callable Function: createConductorUser
 * Allows an authenticated Transport Vendor to securely create a Conductor
 * authentication account via Admin SDK without signing out of the vendor session.
 */
exports.createConductorUser = functions.https.onCall(async (data, context) => {
  // 1. Verify caller authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The request must be authenticated by a logged-in Vendor."
    );
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data().role !== "vendor") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only registered Transport Vendors can provision conductor accounts."
    );
  }

  const { conductorData, password } = data;

  if (!conductorData || !password || password.length < 6) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valid conductor details and a password (min 6 characters) are required."
    );
  }

  const conductorId = conductorData.conductorId.trim().toUpperCase();
  const syntheticEmail = `${conductorId}${AUTH_INTERNAL_DOMAIN}`;

  try {
    // 2. Create Firebase Auth user via Admin SDK
    const userRecord = await admin.auth().createUser({
      email: syntheticEmail,
      emailVerified: true,
      password: password,
      displayName: conductorData.name,
      disabled: false,
    });

    const now = admin.firestore.FieldValue.serverTimestamp();

    // 3. Create document in conductors collection
    const conductorRef = await db.collection("conductors").add({
      uid: userRecord.uid,
      conductorId: conductorId,
      vendorId: callerUid,
      organizationId: conductorData.organizationId,
      organizationName: conductorData.organizationName || "",
      busId: conductorData.busId || "",
      busNumber: conductorData.busNumber || "Unassigned",
      registrationNumber: conductorData.registrationNumber || "",
      routeId: conductorData.routeId || "",
      routeName: conductorData.routeName || "Unassigned",
      name: conductorData.name.trim(),
      employeeId: conductorData.employeeId.trim(),
      phone: conductorData.phone.trim(),
      role: "conductor",
      status: "Active",
      createdAt: now,
      updatedAt: now,
    });

    // 4. Create document in users collection
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      conductorDocId: conductorRef.id,
      conductorId: conductorId,
      name: conductorData.name.trim(),
      phone: conductorData.phone.trim(),
      role: "conductor",
      vendorId: callerUid,
      organizationId: conductorData.organizationId,
      busId: conductorData.busId || "",
      createdAt: now,
    });

    return {
      success: true,
      conductorId: conductorId,
      conductorUid: userRecord.uid,
      conductorDocId: conductorRef.id,
    };
  } catch (error) {
    console.error("Error in createConductorUser function:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Callable Function: setSuperAdminCustomClaims
 * Assigns custom claims ({ role: 'superadmin' }) to a verified Super Admin user.
 * Can only be called by an existing Super Admin or during initial bootstrap.
 */
exports.setSuperAdminCustomClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data().role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Only Super Administrators can assign administrator claims.");
  }

  const targetUid = data.targetUid || callerUid;

  try {
    await admin.auth().setCustomUserClaims(targetUid, { role: "superadmin" });

    // Write server-side audit log
    await db.collection("auditLogs").add({
      actorUid: callerUid,
      actorEmail: context.auth.token.email || callerDoc.data().email || "admin@buspass.local",
      actorRole: "superadmin",
      action: "ASSIGN_ADMIN_CLAIMS",
      targetType: "user",
      targetId: targetUid,
      targetName: data.targetEmail || "Admin User",
      reason: data.reason || "Assigned Super Admin custom claims",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: "Super Admin custom claims set successfully." };
  } catch (error) {
    console.error("Error setting custom claims:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Callable Function: adminSetUserStatus
 * Securely suspends or reactivates any user account with audit trail
 */
exports.adminSetUserStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data().role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Only Super Administrators can change user account status.");
  }

  const { targetUserId, newStatus, reason } = data;
  if (!targetUserId || !newStatus) {
    throw new functions.https.HttpsError("invalid-argument", "targetUserId and newStatus are required.");
  }

  try {
    const userRef = db.collection("users").doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User account not found.");
    }

    const prevStatus = userDoc.data().status || "Active";
    await userRef.update({
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Write audit record
    await db.collection("auditLogs").add({
      actorUid: callerUid,
      actorEmail: context.auth.token.email || callerDoc.data().email,
      actorRole: "superadmin",
      action: newStatus === "Suspended" ? "USER_SUSPENDED" : "USER_REACTIVATED",
      targetType: userDoc.data().role || "user",
      targetId: targetUserId,
      targetName: userDoc.data().name || userDoc.data().businessName || userDoc.data().email || targetUserId,
      details: { previousStatus: prevStatus, newStatus },
      reason: reason || `Account ${newStatus.toLowerCase()} by Super Admin`,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: `Account status successfully updated to ${newStatus}.` };
  } catch (error) {
    console.error("Error updating user status:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
