/**
 * BUS PASS MANAGEMENT SYSTEM - COMMON UTILITIES & UI LOGIC
 * Master UI Helpers, Toast System, Modals, Formatters
 */

// Toast System
function showToast(message, type = 'info', title = null, duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';
  if (type === 'danger') iconClass = 'fa-times-circle';

  let defaultTitle = 'Notification';
  if (type === 'success') defaultTitle = 'Success';
  if (type === 'warning') defaultTitle = 'Warning';
  if (type === 'danger') defaultTitle = 'Error';

  toast.innerHTML = `
    <i class="fas ${iconClass} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title || defaultTitle}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Global modal backdrop close listener
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// Confirmation Modal Helper
function confirmAction(title, message, onConfirm, confirmBtnText = "Confirm Delete", isDanger = true) {
  let modal = document.getElementById('confirm-action-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirm-action-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-dialog modal-sm">
        <div class="modal-header">
          <h3 class="modal-title" id="confirm-modal-title">Confirm Action</h3>
          <button class="modal-close-btn" onclick="closeModal('confirm-action-modal')">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirm-modal-message" style="color: var(--text-secondary); font-size: 0.95rem;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('confirm-action-modal')">Cancel</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-modal-btn">${confirmBtnText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  const btn = document.getElementById('confirm-modal-btn');
  btn.textContent = confirmBtnText;
  btn.className = `btn ${isDanger ? 'btn-danger' : 'btn-primary'}`;
  
  // Replace button to clear previous click listeners
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', async () => {
    closeModal('confirm-action-modal');
    if (typeof onConfirm === 'function') {
      await onConfirm();
    }
  });

  openModal('confirm-action-modal');
}

// Sidebar & Layout Initialization
function initAppShell(activeMenuKey) {
  // Mark active menu item
  if (activeMenuKey) {
    const activeLink = document.querySelector(`.sidebar-link[data-nav="${activeMenuKey}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  // Mobile sidebar toggler
  const toggleBtn = document.querySelector('.menu-toggle-btn');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  const closeBtn = document.querySelector('.sidebar-close-btn');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('show');
    if (backdrop) backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
    document.body.style.overflow = '';
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
}

// Formatters
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Empty & Loading State Helpers
function renderLoading(container, text = 'Loading data...') {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.innerHTML = `
    <div class="state-container">
      <div class="spinner"></div>
      <p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.9rem;">${text}</p>
    </div>
  `;
}

function renderEmptyState(container, title = 'No records found', desc = 'There are no items to display at this moment.', icon = 'fa-folder-open') {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.innerHTML = `
    <div class="state-container">
      <div class="state-icon">
        <i class="fas ${icon}"></i>
      </div>
      <h4 class="state-title">${title}</h4>
      <p class="state-desc">${desc}</p>
    </div>
  `;
}

// Read image file to base64 DataURL (for payment proof screenshot or QR display)
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}
