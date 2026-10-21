/**
 * BUSPASS MANAGEMENT SYSTEM - ORPHANED TRANSIT DATA CLEANUP UTILITY
 * 
 * Scans Firestore collections (organizations, routes, buses, conductors) for records
 * that belonged to deleted vendors or have broken references, and optionally purges them.
 * 
 * Usage:
 *   node scripts/cleanup-orphaned-data.js <adminEmail> <adminPassword> [--purge]
 * 
 * Examples:
 *   # Dry-run scan (safe, no deletions):
 *   node scripts/cleanup-orphaned-data.js admin@buspass.local AdminPassword123!
 * 
 *   # Perform purge of all orphaned records:
 *   node scripts/cleanup-orphaned-data.js admin@buspass.local AdminPassword123! --purge
 */

const https = require('https');

const FIREBASE_API_KEY = "AIzaSyCZ4NSPT8WrI6jHJY3XtS3kmazin5Vr9OI";
const PROJECT_ID = "buspasss";

const args = process.argv.slice(2);
const shouldPurge = args.includes('--purge');
const nonFlagArgs = args.filter(a => !a.startsWith('--'));

const adminEmail = nonFlagArgs[0] || "admin@buspass.local";
const adminPassword = nonFlagArgs[1];

if (!adminPassword && args.includes('--help')) {
  console.log(`
BUSPASS MANAGEMENT SYSTEM - ORPHANED TRANSIT DATA CLEANUP
Usage:
  node scripts/cleanup-orphaned-data.js <adminEmail> <adminPassword> [--purge]

Options:
  --purge   Permanently delete detected orphaned records. Without this flag,
            a dry-run diagnostic report is performed without modifying any data.
  `);
  process.exit(0);
}

function makeHttpRequest(url, method, payload = null, authToken = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
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
    if (payload) req.write(JSON.stringify(payload));
    req.end();
  });
}

function parseFirestoreDoc(doc) {
  if (!doc) return null;
  const nameParts = (doc.name || '').split('/');
  const id = nameParts[nameParts.length - 1];
  const fields = doc.fields || {};
  const data = { id, _rawName: doc.name };

  for (const [key, valObj] of Object.entries(fields)) {
    if ('stringValue' in valObj) data[key] = valObj.stringValue;
    else if ('integerValue' in valObj) data[key] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) data[key] = Number(valObj.doubleValue);
    else if ('booleanValue' in valObj) data[key] = valObj.booleanValue;
    else if ('timestampValue' in valObj) data[key] = valObj.timestampValue;
    else if ('nullValue' in valObj) data[key] = null;
    else if ('arrayValue' in valObj) {
      data[key] = (valObj.arrayValue.values || []).map(v => v.stringValue || v);
    }
  }
  return data;
}

async function fetchAllCollection(collectionName, authToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=300&key=${FIREBASE_API_KEY}`;
  try {
    const res = await makeHttpRequest(url, 'GET', null, authToken);
    const docs = res.documents || [];
    return docs.map(parseFirestoreDoc);
  } catch (err) {
    if (err.message && err.message.includes('NOT_FOUND')) return [];
    throw err;
  }
}

async function deleteFirestoreDoc(rawDocPath, authToken) {
  const url = `https://firestore.googleapis.com/v1/${rawDocPath}?key=${FIREBASE_API_KEY}`;
  return makeHttpRequest(url, 'DELETE', null, authToken);
}

async function main() {
  console.log("=================================================================");
  console.log("  BUSPASS SYSTEM - TRANSIT ORPHAN SCANNER & PURGE UTILITY       ");
  console.log("=================================================================");
  console.log(`Execution Mode : ${shouldPurge ? '>>> PURGE MODE (Permanent Deletion) <<<' : 'DRY RUN (Diagnostic Only)'}`);
  console.log(`Admin Account  : ${adminEmail}`);

  if (!adminPassword) {
    console.error("\n(!) Error: Super Admin password is required to scan/clean Firestore.");
    console.error("    Usage: node scripts/cleanup-orphaned-data.js <adminEmail> <adminPassword> [--purge]");
    process.exit(1);
  }

  // 1. Authenticate Super Admin
  console.log("\n[1/4] Authenticating Super Admin with Firebase Auth...");
  let authToken;
  try {
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const authRes = await makeHttpRequest(signInUrl, 'POST', {
      email: adminEmail,
      password: adminPassword,
      returnSecureToken: true
    });
    authToken = authRes.idToken;
    console.log(`      Authenticated successfully! (UID: ${authRes.localId})`);
  } catch (err) {
    console.error("(!) Authentication failed:", err.message);
    process.exit(1);
  }

  // 2. Fetch all Users and identify active vendors
  console.log("[2/4] Fetching users to map active vendors...");
  const users = await fetchAllCollection('users', authToken);
  const activeVendors = new Map();
  users.forEach(u => {
    if (u.role === 'vendor') {
      activeVendors.set(u.id, u);
    }
  });
  console.log(`      Found ${users.length} total user accounts, ${activeVendors.size} active vendor(s).`);

  // 3. Scan organizations, routes, buses, conductors
  console.log("[3/4] Scanning transit collections for orphaned records...");
  const [orgs, routes, buses, conductors] = await Promise.all([
    fetchAllCollection('organizations', authToken),
    fetchAllCollection('routes', authToken),
    fetchAllCollection('buses', authToken),
    fetchAllCollection('conductors', authToken)
  ]);

  const orphanedOrgs = [];
  const orphanedOrgIds = new Set();
  orgs.forEach(org => {
    if (!org.vendorId || !activeVendors.has(org.vendorId)) {
      orphanedOrgs.push(org);
      orphanedOrgIds.add(org.id);
    }
  });

  const orphanedRoutes = [];
  const orphanedRouteIds = new Set();
  routes.forEach(route => {
    const vendorMissing = !route.vendorId || !activeVendors.has(route.vendorId);
    const orgMissing = route.organizationId && orphanedOrgIds.has(route.organizationId);
    if (vendorMissing || orgMissing) {
      orphanedRoutes.push(route);
      orphanedRouteIds.add(route.id);
    }
  });

  const orphanedBuses = [];
  buses.forEach(bus => {
    const vendorMissing = !bus.vendorId || !activeVendors.has(bus.vendorId);
    const orgMissing = bus.organizationId && orphanedOrgIds.has(bus.organizationId);
    const routeMissing = bus.routeId && orphanedRouteIds.has(bus.routeId);
    if (vendorMissing || orgMissing || routeMissing) {
      orphanedBuses.push(bus);
    }
  });

  const orphanedConductors = [];
  conductors.forEach(cond => {
    const vendorMissing = !cond.vendorId || !activeVendors.has(cond.vendorId);
    const orgMissing = cond.organizationId && orphanedOrgIds.has(cond.organizationId);
    if (vendorMissing || orgMissing) {
      orphanedConductors.push(cond);
    }
  });

  console.log("-----------------------------------------------------------------");
  console.log("DIAGNOSTIC SUMMARY:");
  console.log(`  - Orphaned Colleges / Organizations : ${orphanedOrgs.length}`);
  console.log(`  - Orphaned Transit Routes           : ${orphanedRoutes.length}`);
  console.log(`  - Orphaned Fleet Buses              : ${orphanedBuses.length}`);
  console.log(`  - Orphaned Conductors               : ${orphanedConductors.length}`);
  console.log("-----------------------------------------------------------------");

  if (orphanedOrgs.length > 0) {
    console.log("\nOrphaned Colleges:");
    orphanedOrgs.forEach(o => console.log(`  - ID: ${o.id.padEnd(28)} Name: ${o.name || 'Unnamed'} (vendorId: ${o.vendorId || 'NONE'})`));
  }

  if (orphanedRoutes.length > 0) {
    console.log("\nOrphaned Routes:");
    orphanedRoutes.forEach(r => console.log(`  - ID: ${r.id.padEnd(28)} Name: ${r.routeName || r.name || 'Unnamed'} (vendorId: ${r.vendorId || 'NONE'})`));
  }

  if (orphanedBuses.length > 0) {
    console.log("\nOrphaned Buses:");
    buses.filter(b => orphanedBuses.includes(b)).forEach(b => console.log(`  - ID: ${b.id.padEnd(28)} Reg: ${b.registrationNumber || b.busNumber || 'Unnamed'} (vendorId: ${b.vendorId || 'NONE'})`));
  }

  if (orphanedConductors.length > 0) {
    console.log("\nOrphaned Conductors:");
    orphanedConductors.forEach(c => console.log(`  - ID: ${c.id.padEnd(28)} Name: ${c.name || 'Unnamed'} (vendorId: ${c.vendorId || 'NONE'})`));
  }

  const totalOrphans = orphanedOrgs.length + orphanedRoutes.length + orphanedBuses.length + orphanedConductors.length;

  if (totalOrphans === 0) {
    console.log("\n[SUCCESS] No orphaned records detected! Database integrity is 100% clean.");
    return;
  }

  // 4. Purge if requested
  if (shouldPurge) {
    console.log(`\n[4/4] Purging ${totalOrphans} orphaned records from Firestore...`);

    let count = 0;
    for (const b of orphanedBuses) {
      await deleteFirestoreDoc(b._rawName, authToken).catch(e => console.warn(`Error deleting bus ${b.id}:`, e.message));
      count++;
    }
    for (const r of orphanedRoutes) {
      await deleteFirestoreDoc(r._rawName, authToken).catch(e => console.warn(`Error deleting route ${r.id}:`, e.message));
      count++;
    }
    for (const o of orphanedOrgs) {
      await deleteFirestoreDoc(o._rawName, authToken).catch(e => console.warn(`Error deleting org ${o.id}:`, e.message));
      count++;
    }
    for (const c of orphanedConductors) {
      await deleteFirestoreDoc(c._rawName, authToken).catch(e => console.warn(`Error deleting conductor ${c.id}:`, e.message));
      count++;
    }

    console.log(`\n[COMPLETE] Successfully purged ${count} orphaned transit documents!`);
    console.log("Database integrity restored.");
  } else {
    console.log("\n(!) Notice: This was a dry run. No data was modified.");
    console.log("    To permanently delete these orphaned records, run:");
    console.log(`    node scripts/cleanup-orphaned-data.js ${adminEmail} <password> --purge`);
    console.log("    Or log in as Super Admin and click 'Purge Orphaned Records' in the Admin Console.");
  }
}

main().catch(err => {
  console.error("\nUnexpected execution failure:", err);
  process.exit(1);
});
