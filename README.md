# 🚌 BusPass Pro | Enterprise Bus Pass Management & Fleet Tracking System

A full-stack, production-grade **Bus Pass Management System** built strictly with **HTML5, CSS3, Vanilla JavaScript (ES6+)**, and **Firebase** (Firebase Authentication & Cloud Firestore).

No frontend frameworks (No React, Angular, Vue, Next.js, Bootstrap, or Tailwind). Pure semantic web standards with a consistent SaaS dashboard design system.

---

## 🌟 Key Capabilities & Architecture

```
VENDOR / TRANSPORT ADMIN
        ↓
  ORGANIZATIONS (Colleges / Universities / Corporate Companies)
        ↓
     ROUTES
        ↓
     STOPS (With Stop-Wise Full Year & Semester Pricing)
        ↓
      BUSES (Assigned to Organization & Route)
        ↓
   CONDUCTORS (Auto-generated Conductor ID + Password)
        ↓
    STUDENTS (Browse Services, Multi-Step Pass Application)
        ↓
     PAYMENT (Organization-Specific Dynamic UPI QR Code)
        ↓
VENDOR VERIFICATION (Review Payment Screenshot & Verify)
        ↓
DIGITAL BUS PASS + QR (Hologram Pass with Encrypted Payload)
        ↓
CONDUCTOR QR SCAN (In-Browser Mobile Camera Scanner)
        ↓
  BOARDING RECORD (Allowed / Denied Audit Log with Anti-Passback)
        ↓
LIVE BUS TRACKING (Real-Time GPS Telemetry on Leaflet Maps)
        ↓
   ANALYTICS (Interactive Visualizations via Chart.js)
```

---

## 👥 Three Roles & Portals

### 1. Vendor / Transport Admin (`/vendor-login.html`)
- **Multi-Tenant Organization Management**: Create, edit, activate/deactivate colleges, schools, companies.
- **Route & Dynamic Stop Pricing**: Define transit corridors, departure timings, and customized stop-wise Full Year and Semester fares.
- **Bus Fleet Allocation**: Add buses with capacities, registration plates, drivers, and route assignments.
- **Conductor Provisioning**: Generates unique Conductor IDs (e.g., `CON-7F42A9`) with vendor-set passwords. Built using a secondary Firebase Auth instance so the vendor stays **100% logged in**.
- **Application Review & Payment Verification**: Inspect payment screenshots, verify UPI transactions, approve/reject applications, and issue digital passes.
- **Fleet-Wide GPS Tracking**: Large Leaflet map streaming live vehicle coordinates, pulse markers, and telemetry.
- **Analytics & BI**: Interactive Chart.js graphs tracking pass pipelines, daily boarding scans, and route usage.
- **Organization UPI Gateways**: Configure UPI IDs and payee names per institution with instant QR code generation.

### 2. Student & Commuter (`/login.html` & `/pages/student-dashboard.html`)
- **Self-Service Registration & Profile**: Register with name, email, phone, and password.
- **Multi-Step Application Wizard**:
  - *Step 1*: Select Organization & Route
  - *Step 2*: Pick Boarding Stop & Pass Duration (Full Year / Semester)
  - *Step 3*: View auto-calculated fare, scan official dynamic UPI QR code, upload screenshot receipt & transaction ID
  - *Step 4*: Review summary and submit
- **Official Digital Bus Pass**: Sleek ID card with holographic styling, student details, validity dates, vehicle info, and QR code ready for boarding scans. Includes a **Print / Save as PDF** stylesheet (`@media print`).
- **Pass Renewal**: 1-click renewal workflow pre-filling current route and stop details.
- **Live Bus Tracker**: Real-time Leaflet map displaying the assigned bus marker, live pulsing status, driver details, and arrival information.
- **Notifications Feed**: Real-time alerts for payment verification, pass approvals, and expiration warnings.

### 3. Bus Conductor (`/conductor-login.html` & `/conductor-dashboard.html`)
- **No Email Required**: Conductor logs in using **Conductor ID** (e.g. `CON-7F42A9`) and password.
- **In-Browser Camera QR Scanner**: Integrated `html5-qrcode` scanner with laser overlay that reads student pass QR codes.
- **Instant Cryptographic Verification**: Verifies pass existence, active status, validity dates (`validFrom <= today <= validUntil`), matching organization, and matching route.
- **One-Touch Boarding**: Displays `PASS VALID` with student details and `ALLOW BOARDING` / `DENY BOARDING` buttons.
- **Anti-Passback Safeguard**: Flags duplicate scans for the same student within 5 minutes.
- **Live GPS Duty Broadcasting**: Conductors tap **Start Live Duty** to stream real-time device coordinates to Firebase (`liveBusLocations`), rendering on student and vendor maps.

---

## 📁 Project File Structure

```
d:/BUS-PASS/
├── index.html                   # High-converting SaaS landing page with ecosystem overview
├── login.html                   # Student login page
├── register.html                # Student registration page
├── vendor-login.html            # Transport vendor admin login
├── vendor-register.html         # Vendor company registration
├── vendor-dashboard.html        # Master vendor overview with real-time counters & telemetry
├── vendor-organizations.html    # Organization CRUD (Colleges, Companies, Schools)
├── vendor-routes.html           # Routes & stop-wise pricing management
├── vendor-buses.html            # Bus fleet management & route assignment
├── vendor-conductors.html       # Conductor creation (auto ID + secondary auth)
├── vendor-applications.html     # Application review & payment verification
├── vendor-students.html         # Enrolled commuters directory & pass validity
├── vendor-analytics.html        # Interactive Chart.js analytics dashboard
├── vendor-live-tracking.html    # Full Leaflet live fleet GPS map
├── vendor-payment-settings.html # Org-specific UPI ID & dynamic payment QR settings
├── vendor-settings.html         # Vendor profile & 1-click Demo Data Seeder
├── conductor-login.html         # Conductor duty login (Conductor ID + Password)
├── conductor-dashboard.html     # Camera QR scanner, boarding records & live duty
├── pages/
│   ├── student-dashboard.html   # Student overview & active pass preview
│   ├── apply-pass.html          # Multi-step pass application & UPI payment
│   ├── my-applications.html     # Application history & verification status
│   ├── my-bus-pass.html         # Digital bus pass with QR & Print/PDF
│   ├── renew-pass.html          # Pass renewal portal
│   ├── live-bus.html            # Student real-time bus tracking map
│   ├── notifications.html       # Real-time alert feed & unread counter
│   └── profile.html             # Student profile settings
├── css/
│   └── style.css                # Universal design system (colors, cards, tables, modals, toast)
├── js/
│   ├── firebase-config.js       # Firebase v10 CDN configuration & secondary app initialization
│   ├── auth.js                  # RBAC session guards & synthetic conductor auth
│   ├── common.js                # Toast notifications, modals, date/currency formatters
│   └── utils.js                 # QR code generation, GPS duty tracker, demo seeder
├── firestore.rules              # Multi-tenant security rules with RBAC isolation
└── functions/
    ├── index.js                 # Cloud Functions (createConductorUser via Admin SDK)
    └── package.json
```

---

## 🚀 Getting Started & Local Setup

### Step 1: Open the Project
You can serve the directory with any local static HTTP server:

```powershell
# Using Python
python -m http.server 8080

# Or using Node
npx serve .
```

Open your browser at `http://localhost:8080/index.html`.

### Step 2: Configure Firebase
1. Open [`js/firebase-config.js`](file:///d:/BUS-PASS/js/firebase-config.js).
2. Replace `firebaseConfig` with your credentials from the [Firebase Console](https://console.firebase.google.com/):
   - Project Settings > General > Your Apps > Web app (`</>`).
3. Alternatively, you can open **Vendor Portal > Settings** in the app and paste your configuration JSON directly into the interactive setup dialog!

### Step 3: Enable Firebase Features in Console
- **Firebase Authentication**: Enable **Email/Password** sign-in provider.
- **Cloud Firestore**: Create database in production mode.
- Deploy the provided [`firestore.rules`](file:///d:/BUS-PASS/firestore.rules).

---

## 🧪 Comprehensive Verification Checklist (TEST 1 - TEST 9)

### TEST 1: Vendor Setup
1. Navigate to `/vendor-register.html` and register your agency.
2. Sign in at `/vendor-login.html`.
3. In `/vendor-organizations.html`, create a sample college (e.g. *ABC College of Engineering*).
4. In `/vendor-routes.html`, create a route with stops and Full Year / Semester pricing.
5. In `/vendor-buses.html`, add a bus (`BUS-101`) assigned to this route.
6. In `/vendor-conductors.html`, create a conductor:
   - Conductor ID is auto-generated (`CON-XXXXXX`).
   - Set a duty password.
   - Notice the vendor **remains logged in** throughout creation!
   *(Tip: You can also use the 1-click **Demo Data Seeder** in `/vendor-settings.html` to populate all the above instantly).*

### TEST 2: Conductor Authentication
1. Open `/conductor-login.html`.
2. Enter the generated **Conductor ID** (e.g. `CON-7F42A9`) and the password.
3. Conductor accesses `/conductor-dashboard.html` without ever entering an email address.
4. Conductor sees assigned bus, route, and stop list.

### TEST 3: Student Pass Application
1. Open `/register.html` and create a student account.
2. Log in at `/login.html`.
3. Navigate to **Apply for Pass** (`/pages/apply-pass.html`).
4. Select the organization, route, boarding stop, and pass type.
5. The system dynamically computes the exact fee.
6. The official vendor UPI QR code is displayed with payment details.
7. Enter a transaction reference and upload payment screenshot proof.
8. Submit the application (Status: *Pending*).

### TEST 4: Vendor Verification & Pass Issuance
1. Open `/vendor-applications.html` as the Vendor.
2. The application appears in real-time.
3. Click **Review & Issue**. Inspect the payment proof screenshot.
4. Click **Mark Payment Verified**.
5. Assign a fleet bus and click **Approve & Issue Digital Pass**.
6. The digital pass is generated in Firestore, and an automated alert is sent to the student.

### TEST 5: Digital Pass with QR
1. In the Student Portal, open **My Bus Pass** (`/pages/my-bus-pass.html`).
2. The holographic boarding pass displays with pass number, valid dates, bus details, and a high-security QR code.
3. Click **Print / Save as PDF** to see the clean, media-query print preview.

### TEST 6: Conductor QR Scan & Boarding Log
1. Open `/conductor-dashboard.html` on a mobile device or laptop camera.
2. Click **Scan Student QR**.
3. Point the camera at the student pass QR code.
4. Scanner validates the pass in real-time, displays `PASS VALID`, and enables the **ALLOW BOARDING** button.
5. Tap **ALLOW BOARDING**; a permanent audit entry is logged in `boardingRecords`.
6. Today's allowed counter increments immediately.

### TEST 7: Live GPS Telemetry
1. Conductor clicks **Start Live Duty** on `/conductor-dashboard.html`.
2. Browser Geolocation streams device coordinates to Firestore `liveBusLocations`.
3. Open `/vendor-live-tracking.html`: The bus marker turns live with green pulsating radar on the Leaflet map.
4. Open `/pages/live-bus.html` as the student: The student tracks their assigned bus moving in real-time.

### TEST 8: Stop Duty
1. Conductor taps **Stop Live Duty**.
2. The live pulse marker turns grey/offline on all maps, displaying the last known checkpoint.

### TEST 9: Pass Renewal
1. Student opens `/pages/renew-pass.html`.
2. Current route and stops are pre-filled automatically.
3. Student selects new validity duration, scans payment QR, and submits renewal proof.
4. Vendor verifies and approves, generating a new pass.

---

## 🔒 Security & Best Practices

- **Zero Framework Bloat**: Pure HTML5 semantic markup, CSS3 custom properties design system, and ES6+ modules.
- **No Passwords in Firestore**: All passwords handled exclusively by Firebase Authentication.
- **Secondary App Pattern**: Conductor auth account creation uses a secondary Firebase App instance on the client (or the included Firebase Cloud Function), ensuring vendors never lose their active session.
- **Granular Multi-Tenant Access**: Vendor ID and Organization ID indexing ensures complete isolation across institutional tenants.
