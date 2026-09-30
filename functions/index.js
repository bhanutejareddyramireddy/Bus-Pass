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
