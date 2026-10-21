/**
 * BUSPASS SUPER ADMIN DASHBOARD - COMMON CORE MODULE
 * Shell Injection, Role Guard, Navigation, Immutable Audit Logging, Modals, Pagination
 */

const ADMIN_PAGES = [
  { key: 'dashboard', title: 'Overview', icon: 'fa-chart-pie', url: 'admin-dashboard.html', category: 'Core' },
  { key: 'vendors', title: 'Vendors', icon: 'fa-building', url: 'admin-vendors.html', category: 'Management' },
  { key: 'students', title: 'Students', icon: 'fa-user-graduate', url: 'admin-students.html', category: 'Management' },
  { key: 'organizations', title: 'Organizations', icon: 'fa-university', url: 'admin-organizations.html', category: 'Management' },
  { key: 'fleet-routes', title: 'Fleet and Routes', icon: 'fa-route', url: 'admin-fleet-routes.html', category: 'Fleet & Transit' },
  { key: 'conductors', title: 'Conductors', icon: 'fa-id-badge', url: 'admin-conductors.html', category: 'Fleet & Transit' },
  { key: 'live-fleet', title: 'Live Fleet', icon: 'fa-map-marked-alt', url: 'admin-live-fleet.html', category: 'Fleet & Transit' },
  { key: 'applications', title: 'Applications and Passes', icon: 'fa-ticket-alt', url: 'admin-applications.html', category: 'Operations' },
  { key: 'finance', title: 'Payments', icon: 'fa-wallet', url: 'admin-finance.html', category: 'Operations' },
  { key: 'analytics', title: 'Analytics and Trends', icon: 'fa-chart-line', url: 'admin-analytics.html', category: 'Intelligence' },
  { key: 'audit-logs', title: 'Activity Logs', icon: 'fa-shield-alt', url: 'admin-audit-logs.html', category: 'Governance' },
  { key: 'support', title: 'Support', icon: 'fa-headset', url: 'admin-support.html', category: 'System' },
  { key: 'settings', title: 'Platform Settings', icon: 'fa-sliders-h', url: 'admin-settings.html', category: 'System' }
];

let currentAdminUser = null;
let currentAdminDoc = null;

/**
 * Initializes the Super Admin UI Shell (Sidebar, Topbar, Mobile Drawer)
 */
function initAdminShell(activeKey) {
  renderAdminSidebar(activeKey);
  setupMobileDrawer();
  setupAdminModalGlobalListeners();
}

/**
 * Renders the persistent dark navy sidebar
 */
function renderAdminSidebar(activeKey) {
  const sidebarEl = document.getElementById('admin-sidebar-container');
  if (!sidebarEl) return;

  let currentCategory = '';
  let menuHtml = '';

  ADMIN_PAGES.forEach(page => {
    if (page.category !== currentCategory) {
      currentCategory = page.category;
      menuHtml += `<div class="admin-nav-category">${currentCategory}</div>`;
    }
    const isActive = page.key === activeKey ? 'active' : '';
    menuHtml += `
      <a href="${page.url}" class="admin-nav-item ${isActive}">
        <i class="fas ${page.icon}"></i>
        <span>${page.title}</span>
        ${page.key === 'applications' ? '<span class="admin-nav-badge" id="sidebar-pending-badge" style="display:none;">0</span>' : ''}
        ${page.key === 'live-fleet' ? '<span class="admin-nav-badge" id="sidebar-live-badge" style="display:none; background:#16A34A; color:#fff;">Live</span>' : ''}
      </a>
    `;
  });

  sidebarEl.innerHTML = `
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="admin-sidebar-brand">
        <a href="admin-dashboard.html" class="admin-brand-link">
          <div class="admin-brand-icon">
            <i class="fas fa-bus-alt"></i>
          </div>
          <div>
            <div class="admin-brand-title">BusPass <span class="admin-brand-badge">HQ</span></div>
            <div style="font-size: 0.7rem; color: #94A3B8; font-weight: 500;">Super Admin Workspace</div>
          </div>
        </a>
      </div>

      <nav class="admin-sidebar-menu">
        ${menuHtml}
      </nav>

      <div class="admin-sidebar-footer">
        <div class="admin-user-pill">
          <div class="admin-user-avatar" id="admin-sidebar-avatar">SA</div>
          <div class="admin-user-info">
            <div class="admin-user-name" id="admin-sidebar-name">Super Administrator</div>
            <div class="admin-user-role">Platform Owner</div>
          </div>
          <button class="admin-logout-btn" title="Sign Out" onclick="logoutSuperAdmin()">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </aside>
  `;
}

/**
 * Mobile drawer open/close listeners with backdrop overlay
 */
function setupMobileDrawer() {
  let backdrop = document.getElementById('admin-sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'admin-sidebar-backdrop';
    backdrop.className = 'admin-sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  const toggleBtn = document.getElementById('admin-mobile-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sb = document.getElementById('admin-sidebar');
      if (sb) {
        sb.classList.toggle('open');
        backdrop.classList.toggle('active', sb.classList.contains('open'));
      }
    });
  }

  backdrop.addEventListener('click', () => {
    const sb = document.getElementById('admin-sidebar');
    if (sb) sb.classList.remove('open');
    backdrop.classList.remove('active');
  });

  // Close when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const sb = document.getElementById('admin-sidebar');
    const toggleBtn = document.getElementById('admin-mobile-toggle');
    if (sb && sb.classList.contains('open')) {
      if (!sb.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
        sb.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
      }
    }
  });
}

/**
 * Global Admin Modal Event Listeners
 * Handles backdrop clicks and Escape key to close modals
 */
function setupAdminModalGlobalListeners() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('admin-modal-backdrop') || e.target.classList.contains('admin-modal-overlay')) {
      e.target.classList.remove('show');
      e.target.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-backdrop.show, .admin-modal-overlay.show, .admin-modal-backdrop.active, .admin-modal-overlay.active').forEach(m => {
        m.classList.remove('show');
        m.classList.remove('active');
      });
      document.body.style.overflow = '';
    }
  });
}

/**
 * Super Admin Auth Guard
 * Strictly verifies user is authenticated and has role 'superadmin'
 */
function requireSuperAdmin(onReady) {
  // 1. Initial fast session check
  const activeRole = sessionStorage.getItem('bp_user_role') || localStorage.getItem('bp_user_role');
  const isLoggedOut = sessionStorage.getItem('bp_admin_logged_out') === 'true';

  if (isLoggedOut) {
    document.documentElement.style.display = 'none';
    window.location.replace('admin-login.html');
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      document.documentElement.style.display = 'none';
      window.location.replace('admin-login.html');
      return;
    }

    try {
      // 2. Fetch user record from Firestore
      const userDoc = await db.collection('users').doc(user.uid).get();

      if (!userDoc.exists) {
        console.warn("User record missing in Firestore for UID:", user.uid);
        await auth.signOut();
        document.documentElement.style.display = 'none';
        window.location.replace('admin-login.html?error=unauthorized');
        return;
      }

      const userData = userDoc.data();

      // 3. Strict Super Admin Role Verification
      if (userData.role !== 'superadmin') {
        console.warn("Unauthorized role attempted to access admin portal:", userData.role);
        await auth.signOut();
        document.documentElement.style.display = 'none';
        window.location.replace('admin-login.html?error=access_denied');
        return;
      }

      currentAdminUser = user;
      currentAdminDoc = userData;

      // 4. Force password change if marked
      if (userData.mustChangePassword && !window.location.pathname.includes('admin-settings.html')) {
        // Open mandatory password change modal
        promptFirstTimePasswordChange();
      }

      // 5. Update layout info
      updateAdminLayout(user, userData);

      // 6. Listen for global pending application count badge
      listenToGlobalPendingBadge();

      // 7. Invoke page callback
      if (typeof onReady === 'function') {
        onReady(user, userData);
      }

    } catch (err) {
      console.error("Super Admin auth error:", err);
      showToast("Authentication check failed. Please refresh.", "danger");
    }
  });
}

function updateAdminLayout(user, userData) {
  const nameEl = document.getElementById('admin-sidebar-name');
  const avatarEl = document.getElementById('admin-sidebar-avatar');
  const topbarEmailEl = document.getElementById('admin-topbar-email');

  const displayName = userData.name || user.email.split('@')[0];
  const initials = displayName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || 'SA';

  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) avatarEl.textContent = initials;

  if (topbarEmailEl) {
    topbarEmailEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div class="admin-topbar-beacon" title="Live connection active to Firebase Cloud Firestore">
          <span class="admin-beacon-pulse"></span>
          <span>System Online</span>
        </div>
        <div class="admin-topbar-profile-wrap">
          <button class="admin-topbar-profile-btn" id="admin-profile-menu-btn" onclick="toggleAdminProfileMenu(event)" aria-expanded="false" title="Account Menu">
            <div class="avatar-circle">${escapeHtml(initials)}</div>
            <span style="font-weight: 600; font-size: 0.82rem; color: var(--admin-text-main);">${escapeHtml(displayName)}</span>
            <i class="fas fa-chevron-down" style="font-size: 0.65rem; color: var(--admin-text-muted); margin-left: 2px;"></i>
          </button>
          <div class="admin-topbar-dropdown" id="admin-profile-dropdown">
            <div class="admin-dropdown-header">
              <div class="admin-dropdown-user">${escapeHtml(displayName)}</div>
              <div class="admin-dropdown-email">${escapeHtml(user.email)}</div>
              <span class="admin-dropdown-role">Super Administrator</span>
            </div>
            <a href="admin-dashboard.html" class="admin-dropdown-item">
              <i class="fas fa-chart-pie" style="width: 16px;"></i> Overview
            </a>
            <a href="admin-settings.html" class="admin-dropdown-item">
              <i class="fas fa-sliders-h" style="width: 16px;"></i> Platform Settings
            </a>
            <a href="admin-audit-logs.html" class="admin-dropdown-item">
              <i class="fas fa-shield-alt" style="width: 16px;"></i> Activity Logs
            </a>
            <div style="height: 1px; background: var(--admin-border-subtle); margin: 0.35rem 0;"></div>
            <button class="admin-dropdown-item danger" onclick="logoutSuperAdmin()">
              <i class="fas fa-sign-out-alt" style="width: 16px;"></i> Sign Out
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

function toggleAdminProfileMenu(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('admin-profile-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

// Global click to close profile dropdown
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('admin-profile-dropdown');
  const btn = document.getElementById('admin-profile-menu-btn');
  if (dropdown && dropdown.classList.contains('show')) {
    if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
      dropdown.classList.remove('show');
    }
  }
});

/**
 * Global Real-time badge for pending applications
 */
function listenToGlobalPendingBadge() {
  db.collection('applications')
    .where('status', '==', 'Pending')
    .onSnapshot(snap => {
      const badge = document.getElementById('sidebar-pending-badge');
      const topBadge = document.getElementById('topbar-pending-dot');
      if (badge) {
        badge.textContent = snap.size;
        badge.style.display = snap.size > 0 ? 'inline-block' : 'none';
      }
      if (topBadge) {
        topBadge.style.display = snap.size > 0 ? 'block' : 'none';
      }
    }, err => console.warn("Badge listener warning:", err));

  // Live buses badge
  db.collection('liveBusLocations')
    .where('status', '==', 'ON_DUTY')
    .onSnapshot(snap => {
      const liveBadge = document.getElementById('sidebar-live-badge');
      if (liveBadge) {
        liveBadge.textContent = `${snap.size} Live`;
        liveBadge.style.display = snap.size > 0 ? 'inline-block' : 'none';
      }
    }, err => console.warn("Live badge warning:", err));
}

/**
 * Super Admin Sign Out
 */
async function logoutSuperAdmin() {
  try {
    sessionStorage.setItem('bp_admin_logged_out', 'true');
    localStorage.setItem('bp_admin_logged_out', 'true');
    sessionStorage.removeItem('bp_user_role');
    localStorage.removeItem('bp_user_role');
    await auth.signOut();
  } catch (e) {
    console.warn("Logout error:", e);
  } finally {
    document.documentElement.style.display = 'none';
    window.location.replace('admin-login.html');
  }
}

/**
 * Immutable Audit Logging Helper
 * Writes a permanent administrative action log to 'auditLogs'
 */
async function logAdminAction(action, targetType, targetId, targetName, details = {}, reason = '') {
  try {
    const user = auth.currentUser;
    const actorEmail = (user && user.email) ? user.email : (currentAdminUser ? currentAdminUser.email : 'admin@buspass.local');
    const actorUid = user ? user.uid : 'system';

    const logEntry = {
      actorUid: actorUid,
      actorEmail: actorEmail,
      actorRole: 'superadmin',
      action: action, // e.g., 'VENDOR_SUSPENDED', 'STUDENT_REACTIVATED', 'SETTINGS_UPDATED'
      targetType: targetType, // 'vendor', 'student', 'pass', 'system', 'conductor'
      targetId: targetId || '',
      targetName: targetName || '',
      details: details,
      reason: reason || 'Administrative action by Platform Owner',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('auditLogs').add(logEntry);
  } catch (err) {
    console.error("Failed to record admin audit log:", err);
  }
}

/**
 * Reusable Confirmation Dialog Modal
 */
function adminConfirmModal(title, message, confirmBtnText = 'Confirm', onConfirm, isDanger = false) {
  let modalBackdrop = document.getElementById('admin-confirm-modal');
  if (!modalBackdrop) {
    modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'admin-modal-backdrop';
    modalBackdrop.id = 'admin-confirm-modal';
    document.body.appendChild(modalBackdrop);
  }

  modalBackdrop.innerHTML = `
    <div class="admin-modal-dialog modal-sm">
      <div class="admin-modal-header" style="${isDanger ? 'border-bottom: 2px solid #EF4444;' : ''}">
        <h3 class="admin-modal-title" style="${isDanger ? 'color: #EF4444;' : ''}">
          <i class="fas ${isDanger ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i> ${title}
        </h3>
        <button class="admin-modal-close" onclick="closeAdminConfirm()">&times;</button>
      </div>
      <div class="admin-modal-body">
        <p style="font-size: 0.9rem; color: var(--admin-text-main); line-height: 1.5;">${message}</p>
        <div id="admin-confirm-reason-wrap" style="margin-top: 1rem; display: none;">
          <label class="admin-form-label" for="admin-confirm-reason">Action Reason / Notes <span class="required">*</span></label>
          <input type="text" id="admin-confirm-reason" class="admin-form-control" placeholder="Provide audit trail justification...">
        </div>
      </div>
      <div class="admin-modal-footer">
        <button type="button" class="admin-btn admin-btn-secondary" onclick="closeAdminConfirm()">Cancel</button>
        <button type="button" id="admin-confirm-proceed-btn" class="admin-btn ${isDanger ? 'admin-btn-danger' : 'admin-btn-primary'}">
          ${confirmBtnText}
        </button>
      </div>
    </div>
  `;

  modalBackdrop.classList.add('show');

  const btn = document.getElementById('admin-confirm-proceed-btn');
  btn.onclick = async () => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Processing...';
    try {
      const reason = document.getElementById('admin-confirm-reason')?.value || '';
      if (typeof onConfirm === 'function') {
        await onConfirm(reason);
      }
      closeAdminConfirm();
    } catch (e) {
      showToast(e.message || "Action failed", "danger");
      btn.disabled = false;
      btn.textContent = confirmBtnText;
    }
  };
}

function closeAdminConfirm() {
  const mb = document.getElementById('admin-confirm-modal');
  if (mb) mb.classList.remove('show');
}

/**
 * Mandatory First-Time Password Change Prompt
 */
function promptFirstTimePasswordChange() {
  let modal = document.getElementById('admin-first-login-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'admin-modal-backdrop show';
    modal.id = 'admin-first-login-modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="admin-modal-dialog">
      <div class="admin-modal-header" style="border-bottom: 2px solid var(--admin-primary);">
        <h3 class="admin-modal-title">
          <i class="fas fa-key text-primary"></i> First-Time Security Setup
        </h3>
      </div>
      <form id="admin-force-pass-form">
        <div class="admin-modal-body">
          <div style="background: var(--admin-primary-subtle); padding: 0.85rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.84rem; color: var(--admin-primary-dark);">
            <i class="fas fa-shield-alt"></i> <strong>Initial Setup Required:</strong> You logged in with a temporary setup password. Please create your permanent, strong Super Admin password to continue.
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label" for="fp-new-pass">New Admin Password <span class="required">*</span></label>
            <input type="password" id="fp-new-pass" class="admin-form-control" placeholder="Min. 8 chars (letters, numbers, symbols)" required minlength="8" autocomplete="new-password">
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label" for="fp-confirm-pass">Confirm Password <span class="required">*</span></label>
            <input type="password" id="fp-confirm-pass" class="admin-form-control" placeholder="Re-enter new password" required minlength="8" autocomplete="new-password">
          </div>
        </div>
        <div class="admin-modal-footer">
          <button type="submit" id="fp-submit-btn" class="admin-btn admin-btn-primary admin-btn-lg" style="width: 100%;">
            <i class="fas fa-lock"></i> Set Permanent Password & Proceed
          </button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('admin-force-pass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = document.getElementById('fp-new-pass').value;
    const p2 = document.getElementById('fp-confirm-pass').value;
    if (p1 !== p2) {
      showToast("Passwords do not match.", "warning");
      return;
    }
    if (p1.length < 8) {
      showToast("Password must be at least 8 characters long.", "warning");
      return;
    }

    const btn = document.getElementById('fp-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Updating credentials...';

    try {
      const user = auth.currentUser;
      await user.updatePassword(p1);
      await db.collection('users').doc(user.uid).update({
        mustChangePassword: false,
        passwordChangedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await logAdminAction('FIRST_LOGIN_PASSWORD_SET', 'system', user.uid, user.email, {}, 'Initial setup password replaced');
      showToast("Password successfully updated! Welcome to BusPass Admin.", "success");
      modal.remove();
    } catch (err) {
      console.error("Force pass error:", err);
      showToast(err.message, "danger");
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock"></i> Set Permanent Password & Proceed';
    }
  });
}

/**
 * Reusable Client-Side Table Pagination
 */
function paginateTable(items, currentPage, pageSize) {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const page = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const paginatedItems = items.slice(startIndex, endIndex);

  return {
    items: paginatedItems,
    page: page,
    pageSize: pageSize,
    total: total,
    totalPages: totalPages,
    startIndex: startIndex,
    endIndex: endIndex
  };
}

function renderPaginationControls(containerId, paginationObj, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, totalPages, total, startIndex, endIndex } = paginationObj;

  if (total === 0) {
    container.innerHTML = `<span style="font-size:0.8rem; color:var(--admin-text-muted);">No records</span>`;
    return;
  }

  let pagesHtml = '';
  // Show max 5 buttons around current
  const startBtn = Math.max(1, page - 2);
  const endBtn = Math.min(totalPages, page + 2);

  for (let p = startBtn; p <= endBtn; p++) {
    pagesHtml += `
      <button class="admin-page-btn ${p === page ? 'active' : ''}" onclick="${onPageChange}(${p})">
        ${p}
      </button>
    `;
  }

  container.innerHTML = `
    <div>
      Showing <strong>${startIndex + 1}</strong> to <strong>${endIndex}</strong> of <strong>${total}</strong> entries
    </div>
    <div class="admin-pagination-pages">
      <button class="admin-page-btn" ${page <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${page - 1})" title="Previous Page">
        <i class="fas fa-chevron-left" style="font-size:0.7rem;"></i>
      </button>
      ${pagesHtml}
      <button class="admin-page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="${onPageChange}(${page + 1})" title="Next Page">
        <i class="fas fa-chevron-right" style="font-size:0.7rem;"></i>
      </button>
    </div>
  `;
}

/**
 * Common Formatters
 */
function formatCurrency(amount) {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
}

function formatDate(dateInput) {
  if (!dateInput) return '-';
  let d;
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    d = dateInput.toDate();
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(dateInput) {
  if (!dateInput) return '-';
  let d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function timeAgo(dateInput) {
  if (!dateInput) return '-';
  let d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

/**
 * Safely escapes HTML special characters to prevent XSS and rendering errors
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ============================================================================
 * CASCADE DELETION & ORPHAN INTEGRITY UTILITIES
 * ============================================================================
 */

/**
 * Permanently cascade-deletes a Vendor account and ALL of their associated operational data:
 * - Organizations created by vendor
 * - Routes created by vendor or assigned to vendor's organizations
 * - Buses created by vendor or assigned to vendor's organizations/routes
 * - Live bus locations for those buses
 * - Conductors created by vendor AND their conductor login accounts in users collection
 * - Applications associated with vendor
 * - Passes associated with vendor
 * - Boarding records associated with vendor
 * - Notifications directed to vendor
 * - Vendor record in users collection
 */
async function cascadeDeleteVendorData(vendorId) {
  if (!vendorId) throw new Error("Vendor ID is required for cascade deletion.");

  const stats = {
    organizations: 0,
    routes: 0,
    buses: 0,
    conductors: 0,
    conductorUsers: 0,
    applications: 0,
    passes: 0,
    boardingRecords: 0,
    notifications: 0
  };

  // 1. Gather all organizations owned by this vendor
  const orgSnap = await db.collection('organizations').where('vendorId', '==', vendorId).get().catch(() => ({ docs: [] }));
  const orgIds = new Set(orgSnap.docs.map(d => d.id));

  // 2. Gather all routes owned by this vendor or pointing to their organizations
  const routeDocMap = new Map();
  const routeByVendorSnap = await db.collection('routes').where('vendorId', '==', vendorId).get().catch(() => ({ docs: [] }));
  routeByVendorSnap.docs.forEach(d => routeDocMap.set(d.id, d));

  if (orgIds.size > 0) {
    for (const orgId of orgIds) {
      const routeByOrgSnap = await db.collection('routes').where('organizationId', '==', orgId).get().catch(() => ({ docs: [] }));
      routeByOrgSnap.docs.forEach(d => routeDocMap.set(d.id, d));
    }
  }
  const routeIds = new Set(routeDocMap.keys());

  // 3. Gather all buses owned by this vendor, or pointing to their orgs/routes
  const busDocMap = new Map();
  const busByVendorSnap = await db.collection('buses').where('vendorId', '==', vendorId).get().catch(() => ({ docs: [] }));
  busByVendorSnap.docs.forEach(d => busDocMap.set(d.id, d));

  if (orgIds.size > 0) {
    for (const orgId of orgIds) {
      const busByOrgSnap = await db.collection('buses').where('organizationId', '==', orgId).get().catch(() => ({ docs: [] }));
      busByOrgSnap.docs.forEach(d => busDocMap.set(d.id, d));
    }
  }

  if (routeIds.size > 0) {
    for (const routeId of routeIds) {
      const busByRouteSnap = await db.collection('buses').where('routeId', '==', routeId).get().catch(() => ({ docs: [] }));
      busByRouteSnap.docs.forEach(d => busDocMap.set(d.id, d));
    }
  }
  const busIds = new Set(busDocMap.keys());

  // 4. Delete Live Bus Locations for all found buses
  for (const busId of busIds) {
    await db.collection('liveBusLocations').doc(busId).delete().catch(() => {});
  }

  // 5. Gather and delete Conductors and their user auth accounts
  const condDocMap = new Map();
  const condByVendorSnap = await db.collection('conductors').where('vendorId', '==', vendorId).get().catch(() => ({ docs: [] }));
  condByVendorSnap.docs.forEach(d => condDocMap.set(d.id, d));

  if (orgIds.size > 0) {
    for (const orgId of orgIds) {
      const condByOrgSnap = await db.collection('conductors').where('organizationId', '==', orgId).get().catch(() => ({ docs: [] }));
      condByOrgSnap.docs.forEach(d => condDocMap.set(d.id, d));
    }
  }

  for (const cDoc of condDocMap.values()) {
    const cData = cDoc.data();
    if (cData.uid) {
      await db.collection('users').doc(cData.uid).delete().catch(() => {});
      stats.conductorUsers++;
    }
    await cDoc.ref.delete().catch(() => {});
    stats.conductors++;
  }

  // 6. Delete all Buses
  for (const bDoc of busDocMap.values()) {
    await bDoc.ref.delete().catch(() => {});
    stats.buses++;
  }

  // 7. Delete all Routes
  for (const rDoc of routeDocMap.values()) {
    await rDoc.ref.delete().catch(() => {});
    stats.routes++;
  }

  // 8. Delete all Organizations
  for (const oDoc of orgSnap.docs) {
    await oDoc.ref.delete().catch(() => {});
    stats.organizations++;
  }

  // 9. Delete Applications for this vendor
  const appSnap = await db.collection('applications').where('vendorId', '==', vendorId).get().catch(() => ({ docs: [] }));
  for (const aDoc of appSnap.docs) {
    await aDoc.ref.delete().catch(() => {});
    stats.applications++;
  }

  // 10. Delete Passes for this vendor
  const passSnap = await db.collection('passes').where('vendorId', '==', vendorId).get().catch(() => ({ docs: [] }));
  for (const pDoc of passSnap.docs) {
    await pDoc.ref.delete().catch(() => {});
    stats.passes++;
  }

  // 11. Delete Boarding Records for this vendor
  const bSnap = await db.collection('boardingRecords').where('vendorId', '==', vendorId).get().catch(() => ({ docs: [] }));
  for (const bd of bSnap.docs) {
    await bd.ref.delete().catch(() => {});
    stats.boardingRecords++;
  }

  // 12. Delete Notifications for this vendor
  const notifSnap = await db.collection('notifications').where('userId', '==', vendorId).get().catch(() => ({ docs: [] }));
  for (const n of notifSnap.docs) {
    await n.ref.delete().catch(() => {});
    stats.notifications++;
  }

  // 13. Delete Vendor document in users
  await db.collection('users').doc(vendorId).delete().catch(() => {});

  return stats;
}

/**
 * Permanently cascade-deletes a Student account and their associated records:
 * - Passes
 * - Applications
 * - Notifications
 * - Student record in users
 */
async function cascadeDeleteStudentData(studentId) {
  if (!studentId) throw new Error("Student ID is required.");

  const stats = { passes: 0, applications: 0, notifications: 0 };

  const passSnap = await db.collection('passes').where('studentId', '==', studentId).get().catch(() => ({ docs: [] }));
  for (const d of passSnap.docs) {
    await d.ref.delete().catch(() => {});
    stats.passes++;
  }

  const appSnap = await db.collection('applications').where('studentId', '==', studentId).get().catch(() => ({ docs: [] }));
  for (const d of appSnap.docs) {
    await d.ref.delete().catch(() => {});
    stats.applications++;
  }

  const notifSnap = await db.collection('notifications').where('userId', '==', studentId).get().catch(() => ({ docs: [] }));
  for (const d of notifSnap.docs) {
    await d.ref.delete().catch(() => {});
    stats.notifications++;
  }

  await db.collection('users').doc(studentId).delete().catch(() => {});
  return stats;
}

/**
 * Permanently cascade-deletes an Organization and its connected routes/buses
 */
async function cascadeDeleteOrgData(orgId, vendorId = null) {
  if (!orgId) throw new Error("Organization ID is required.");

  let routeQuery = db.collection('routes').where('organizationId', '==', orgId);
  if (vendorId) routeQuery = routeQuery.where('vendorId', '==', vendorId);
  const routeSnap = await routeQuery.get().catch(() => ({ docs: [] }));
  for (const r of routeSnap.docs) {
    await r.ref.delete().catch(() => {});
  }

  let busQuery = db.collection('buses').where('organizationId', '==', orgId);
  if (vendorId) busQuery = busQuery.where('vendorId', '==', vendorId);
  const busSnap = await busQuery.get().catch(() => ({ docs: [] }));
  for (const b of busSnap.docs) {
    await b.ref.update({
      organizationId: '',
      organizationName: 'Unassigned',
      routeId: '',
      routeName: 'Unassigned',
      status: 'Inactive'
    }).catch(() => {});
  }

  await db.collection('organizations').doc(orgId).delete();
  return { routesDeleted: routeSnap.docs ? routeSnap.docs.length : 0 };
}

/**
 * Permanently deletes a single transit Route and unassigns linked buses/staff
 */
async function cascadeDeleteRouteData(routeId) {
  if (!routeId) throw new Error("Route ID is required.");

  // Unassign buses
  const busSnap = await db.collection('buses').where('routeId', '==', routeId).get().catch(() => ({ docs: [] }));
  for (const b of busSnap.docs) {
    await b.ref.update({
      routeId: '',
      routeName: 'Unassigned',
      status: 'Inactive'
    }).catch(() => {});
  }

  // Unassign conductors
  const condSnap = await db.collection('conductors').where('routeId', '==', routeId).get().catch(() => ({ docs: [] }));
  for (const c of condSnap.docs) {
    await c.ref.update({
      routeId: '',
      routeName: 'Unassigned'
    }).catch(() => {});
  }

  await db.collection('routes').doc(routeId).delete();
  return { busesUnassigned: busSnap.docs.length, conductorsUnassigned: condSnap.docs.length };
}

/**
 * Permanently deletes a single Bus and its live tracking record
 */
async function cascadeDeleteBusData(busId) {
  if (!busId) throw new Error("Bus ID is required.");

  await db.collection('liveBusLocations').doc(busId).delete().catch(() => {});

  // Unassign any conductors assigned to this bus
  const condSnap = await db.collection('conductors').where('busId', '==', busId).get().catch(() => ({ docs: [] }));
  for (const c of condSnap.docs) {
    await c.ref.update({
      busId: 'Unassigned',
      busNumber: 'Unassigned',
      registrationNumber: ''
    }).catch(() => {});
  }

  await db.collection('buses').doc(busId).delete();
}

/**
 * Scans all collections for orphaned transit records (colleges/organizations, routes, buses, conductors)
 * that belong to deleted vendor accounts or have missing/broken vendor references.
 */
async function scanForOrphanedTransitData() {
  const [vendorsSnap, orgsSnap, routesSnap, busesSnap, condsSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'vendor').get().catch(() => ({ docs: [] })),
    db.collection('organizations').get().catch(() => ({ docs: [] })),
    db.collection('routes').get().catch(() => ({ docs: [] })),
    db.collection('buses').get().catch(() => ({ docs: [] })),
    db.collection('conductors').get().catch(() => ({ docs: [] }))
  ]);

  const validVendorIds = new Set(vendorsSnap.docs.map(d => d.id));

  const orphanedOrgs = [];
  const orphanedOrgIds = new Set();
  orgsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.vendorId || !validVendorIds.has(data.vendorId)) {
      orphanedOrgs.push({ id: doc.id, ...data });
      orphanedOrgIds.add(doc.id);
    }
  });

  const orphanedRoutes = [];
  const orphanedRouteIds = new Set();
  routesSnap.docs.forEach(doc => {
    const data = doc.data();
    const vendorMissing = !data.vendorId || !validVendorIds.has(data.vendorId);
    const orgMissing = data.organizationId && orphanedOrgIds.has(data.organizationId);
    if (vendorMissing || orgMissing) {
      orphanedRoutes.push({ id: doc.id, ...data });
      orphanedRouteIds.add(doc.id);
    }
  });

  const orphanedBuses = [];
  busesSnap.docs.forEach(doc => {
    const data = doc.data();
    const vendorMissing = !data.vendorId || !validVendorIds.has(data.vendorId);
    const orgMissing = data.organizationId && orphanedOrgIds.has(data.organizationId);
    const routeMissing = data.routeId && orphanedRouteIds.has(data.routeId);
    if (vendorMissing || orgMissing || routeMissing) {
      orphanedBuses.push({ id: doc.id, ...data });
    }
  });

  const orphanedConductors = [];
  condsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.vendorId || !validVendorIds.has(data.vendorId)) {
      orphanedConductors.push({ id: doc.id, ...data });
    }
  });

  return {
    validVendorIds,
    orphanedOrgs,
    orphanedRoutes,
    orphanedBuses,
    orphanedConductors,
    totalOrphans: orphanedOrgs.length + orphanedRoutes.length + orphanedBuses.length + orphanedConductors.length
  };
}

/**
 * Permanently purges all orphaned transit data (colleges, routes, buses, conductors)
 * that have no active or existing vendor in the database.
 */
async function purgeAllOrphanedTransitData() {
  const scan = await scanForOrphanedTransitData();

  for (const b of scan.orphanedBuses) {
    await db.collection('liveBusLocations').doc(b.id).delete().catch(() => {});
    await db.collection('buses').doc(b.id).delete().catch(() => {});
  }

  for (const c of scan.orphanedConductors) {
    if (c.uid) {
      await db.collection('users').doc(c.uid).delete().catch(() => {});
    }
    await db.collection('conductors').doc(c.id).delete().catch(() => {});
  }

  for (const r of scan.orphanedRoutes) {
    await db.collection('routes').doc(r.id).delete().catch(() => {});
  }

  for (const o of scan.orphanedOrgs) {
    await db.collection('organizations').doc(o.id).delete().catch(() => {});
  }

  return {
    purgedOrgs: scan.orphanedOrgs.length,
    purgedRoutes: scan.orphanedRoutes.length,
    purgedBuses: scan.orphanedBuses.length,
    purgedConductors: scan.orphanedConductors.length,
    totalPurged: scan.totalOrphans
  };
}

