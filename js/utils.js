/**
 * BUS PASS MANAGEMENT SYSTEM - UTILITIES & REAL-TIME HELPERS
 * QR Generation, GPS Duty Tracker, Leaflet Helpers, Notifications
 */

// High-Resilient QR Code Generator with Auto-Fallback
function generatePassQRCode(elementId, qrDataString, width = 180, height = 180) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = ''; // clear existing

  let payload = typeof qrDataString === 'object' ? JSON.stringify(qrDataString) : String(qrDataString || '').trim();
  if (!payload) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:0.75rem;">No QR Payload</span>';
    return;
  }

  // Attempt client-side rendering with QRCode.js first
  let renderedSuccessfully = false;

  if (typeof QRCode !== 'undefined') {
    try {
      // Use CorrectLevel.M (Medium) or L to prevent "code length overflow" exceptions on long payloads
      const level = (QRCode.CorrectLevel && QRCode.CorrectLevel.M !== undefined) ? QRCode.CorrectLevel.M : 0;
      new QRCode(container, {
        text: payload,
        width: width,
        height: height,
        colorDark: "#0F172A",
        colorLight: "#FFFFFF",
        correctLevel: level
      });

      if (container.querySelector('canvas') || container.querySelector('img')) {
        renderedSuccessfully = true;
      }
    } catch (overflowErr) {
      console.warn("Client QRCode.js error (attempting compact identifier fallback):", overflowErr);
      // Fallback: If JSON caused code length overflow, encode just the pass ID string
      try {
        let compactId = payload;
        try {
          const parsed = JSON.parse(payload);
          compactId = parsed.passId || parsed.id || payload;
        } catch (e) {}

        container.innerHTML = '';
        new QRCode(container, {
          text: compactId,
          width: width,
          height: height,
          colorDark: "#0F172A",
          colorLight: "#FFFFFF",
          correctLevel: 0
        });

        if (container.querySelector('canvas') || container.querySelector('img')) {
          renderedSuccessfully = true;
        }
      } catch (innerErr) {
        console.warn("Compact client-side QR also failed:", innerErr);
      }
    }
  }

  // Reliable Universal Fallback: If library not loaded or canvas failed, generate high-res QR image
  if (!renderedSuccessfully) {
    let imgPayload = payload;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.passId) imgPayload = parsed.passId;
    } catch(e) {}

    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${width}x${height}&margin=4&data=${encodeURIComponent(imgPayload)}`;
    img.alt = 'Bus Pass QR Code';
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.style.display = 'block';
    img.style.margin = '0 auto';
    img.style.borderRadius = '4px';
    img.onerror = () => {
      container.innerHTML = `
        <div style="padding: 0.5rem; text-align: center; border: 1px dashed var(--border-color); border-radius: 6px;">
          <i class="fas fa-qrcode" style="font-size: 2rem; color: var(--primary); margin-bottom: 0.25rem;"></i>
          <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted); word-break: break-all;">${imgPayload}</div>
        </div>
      `;
    };
    container.innerHTML = '';
    container.appendChild(img);
  }
}

// Prepare secure QR payload string (JSON)
function createPassQRPayload(passData) {
  return JSON.stringify({
    passId: passData.passId || passData.id,
    studentId: passData.studentId || '',
    routeId: passData.routeId || '',
    validUntil: passData.validUntil || ''
  });
}

// Send In-App Notification to User
async function sendNotification(userId, type, title, message) {
  try {
    await db.collection('notifications').add({
      userId: userId,
      type: type, // 'application', 'payment', 'pass', 'system'
      title: title,
      message: message,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

// Live Duty Geolocation Tracker for Conductors
class BusLocationTracker {
  constructor() {
    this.watchId = null;
    this.busId = null;
    this.isTracking = false;
  }

  start(busData, onUpdate, onError) {
    if (!navigator.geolocation) {
      if (onError) onError(new Error("Geolocation is not supported by your browser."));
      return false;
    }

    this.busId = busData.busId;
    this.isTracking = true;

    // First do an immediate push
    navigator.geolocation.getCurrentPosition(
      (pos) => this.pushLocation(pos, busData, onUpdate),
      (err) => { if (onError) onError(err); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Then start watching continuous updates
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.pushLocation(pos, busData, onUpdate),
      (err) => { if (onError) onError(err); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return true;
  }

  async pushLocation(position, busData, onUpdate) {
    if (!this.isTracking || !this.busId) return;

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    const locationDoc = {
      vendorId: busData.vendorId,
      organizationId: busData.organizationId,
      busId: busData.busId,
      busNumber: busData.busNumber,
      conductorId: busData.conductorId,
      conductorName: busData.conductorName || '',
      routeId: busData.routeId,
      routeName: busData.routeName || '',
      latitude: lat,
      longitude: lng,
      accuracy: accuracy,
      isLive: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('liveBusLocations').doc(this.busId).set(locationDoc, { merge: true });
      if (typeof onUpdate === 'function') {
        onUpdate({ latitude: lat, longitude: lng, accuracy: accuracy, timestamp: new Date() });
      }
    } catch (e) {
      console.error("Failed to update live bus location:", e);
    }
  }

  async stop(busId) {
    const idToStop = busId || this.busId;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;

    if (idToStop) {
      try {
        await db.collection('liveBusLocations').doc(idToStop).set({
          isLive: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Failed to set bus offline:", e);
      }
    }
  }
}

const globalBusTracker = new BusLocationTracker();

// Leaflet Map Custom Marker Creator
function createBusMarker(lat, lng, busNumber, isLive = true) {
  const iconHtml = `
    <div class="bus-marker-icon" style="${isLive ? 'background: var(--primary);' : 'background: #64748B;'}">
      <i class="fas fa-bus"></i>
      ${isLive ? '<span class="pulse-dot"></span>' : ''}
    </div>
  `;

  const customIcon = L.divIcon({
    html: iconHtml,
    className: 'custom-leaflet-bus',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });

  return L.marker([lat, lng], { icon: customIcon });
}

/**
 * Optional Demo Data Seeder for Vendor demonstration.
 * Creates a sample College Organization, Route with 4 Stops, Bus, and Conductor.
 */
async function seedSampleVendorData(vendorId) {
  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    // 1. Create Organization
    const orgRef = await db.collection('organizations').add({
      vendorId: vendorId,
      name: "St. Xavier Institute of Technology",
      type: "College",
      location: "Hyderabad, Telangana",
      address: "Campus Rd, Outer Ring Rd, Financial District, Hyderabad",
      contact: "040-23456789",
      description: "Premier engineering and technology campus transport network.",
      status: "Active",
      upiId: "stxavier.transport@upi",
      payeeName: "St. Xavier Transport Fund",
      paymentEnabled: true,
      createdAt: now,
      updatedAt: now
    });

    const orgId = orgRef.id;

    // 2. Create Route with Stops & Pricing
    const routeRef = await db.collection('routes').add({
      vendorId: vendorId,
      organizationId: orgId,
      organizationName: "St. Xavier Institute of Technology",
      routeName: "Route 14: Jadcherla → Campus",
      startPoint: "Jadcherla Bus Stand",
      destination: "St. Xavier Main Gate",
      morningTime: "07:30",
      eveningTime: "16:45",
      status: "Active",
      stops: [
        { name: "Jadcherla", fullYearFee: 26000, semesterFee: 14000 },
        { name: "Mahbubnagar", fullYearFee: 24000, semesterFee: 13000 },
        { name: "Shadnagar", fullYearFee: 20000, semesterFee: 11000 },
        { name: "Shamshabad Junction", fullYearFee: 16000, semesterFee: 9000 },
        { name: "Campus Gate", fullYearFee: 12000, semesterFee: 7000 }
      ],
      createdAt: now,
      updatedAt: now
    });

    const routeId = routeRef.id;

    // 3. Create Bus
    const busRef = await db.collection('buses').add({
      vendorId: vendorId,
      organizationId: orgId,
      organizationName: "St. Xavier Institute of Technology",
      routeId: routeId,
      routeName: "Route 14: Jadcherla → Campus",
      busNumber: "BUS-101",
      registrationNumber: "TS09AB1234",
      capacity: 50,
      driverName: "Ramesh Goud",
      morningTime: "07:30",
      eveningTime: "16:45",
      status: "Active",
      createdAt: now,
      updatedAt: now
    });

    const busId = busRef.id;

    // Initialize bus live tracking state in liveBusLocations
    await db.collection('liveBusLocations').doc(busId).set({
      vendorId: vendorId,
      organizationId: orgId,
      busId: busId,
      busNumber: "BUS-101",
      latitude: 17.3850,
      longitude: 78.4867,
      accuracy: 10,
      isLive: false,
      updatedAt: now
    });

    return { orgId, routeId, busId };
  } catch (e) {
    console.error("Error seeding sample vendor data:", e);
    throw e;
  }
}
