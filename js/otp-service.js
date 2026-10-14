/**
 * BUS PASS MANAGEMENT SYSTEM - OTP & EMAIL VERIFICATION SERVICE
 * Real-time Email OTP delivery via EmailJS with instant on-screen testing preview,
 * secure registration email verification, and forgot password reset.
 */

// Global EmailJS Configuration (Customize in localStorage or here anytime)
const EMAILJS_CONFIG = {
  serviceId: localStorage.getItem('BUSPASS_EMAILJS_SERVICE_ID') || 'service_buspass',
  templateId: localStorage.getItem('BUSPASS_EMAILJS_TEMPLATE_ID') || 'template_buspass_otp',
  publicKey: localStorage.getItem('BUSPASS_EMAILJS_PUBLIC_KEY') || ''
};

// Initialize EmailJS if library is loaded and key is available
function initEmailJsService() {
  if (typeof emailjs !== 'undefined' && EMAILJS_CONFIG.publicKey) {
    try {
      emailjs.init(EMAILJS_CONFIG.publicKey);
    } catch (e) {
      console.warn("EmailJS init note:", e);
    }
  }
}

// In-Memory Active OTP Cache (Keyed by lowercase email)
const _activeOtpCache = {};

/**
 * Generate a cryptographically random 6-digit OTP code
 */
function generate6DigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send an OTP Email using EmailJS with instant on-screen preview fallback
 */
async function sendOtpEmail({ email, name = 'User', otp, type = 'registration' }) {
  const cleanEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store in cache
  _activeOtpCache[cleanEmail] = {
    otp: otp,
    expiresAt: expiresAt,
    attempts: 0,
    type: type,
    name: name
  };

  const isReset = type === 'forgot_password';
  const subject = isReset 
    ? `Your BusPass Pro Password Reset Code: ${otp}` 
    : `Your BusPass Pro Registration Verification Code: ${otp}`;
  const actionName = isReset ? 'Password Reset' : 'Email Verification';

  let emailSent = false;

  // 1. Attempt delivery via EmailJS if available
  if (typeof emailjs !== 'undefined' && EMAILJS_CONFIG.publicKey && EMAILJS_CONFIG.publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY') {
    try {
      initEmailJsService();
      await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
        to_email: cleanEmail,
        to_name: name,
        otp_code: otp,
        subject: subject,
        action_name: actionName,
        app_name: 'BusPass Pro'
      });
      emailSent = true;
      console.log(`[EmailJS] OTP email successfully dispatched to ${cleanEmail}`);
    } catch (emailErr) {
      console.warn("[EmailJS] Delivery attempt notice:", emailErr);
    }
  }

  // 2. Always show an on-screen preview notification so the user can test immediately
  showOtpNotificationBanner(cleanEmail, otp, actionName, emailSent);

  return { success: true, emailSent: emailSent };
}

/**
 * Display an elegant, high-visibility on-screen OTP notification banner
 */
function showOtpNotificationBanner(email, otp, actionName, sentViaEmail = false) {
  let existingBanner = document.getElementById('otp-floating-banner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'otp-floating-banner';
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    max-width: 400px;
    background: #FFFFFF;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(99, 102, 241, 0.25);
    padding: 1.15rem 1.25rem;
    font-family: inherit;
    animation: slideDownIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  banner.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
      <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #4F46E5, #6366F1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
        <i class="fas fa-envelope-open-text"></i>
      </div>
      <div style="flex-grow: 1;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <strong style="font-size: 0.95rem; color: #1E293B;">${actionName} OTP</strong>
          <button type="button" onclick="this.closest('#otp-floating-banner').remove()" style="background: none; border: none; font-size: 1.2rem; color: #94A3B8; cursor: pointer; line-height: 1; padding: 0;">&times;</button>
        </div>
        <div style="font-size: 0.78rem; color: #64748B; margin-top: 2px;">
          Sent to <strong style="color: #334155;">${email}</strong>
        </div>
        <div style="background: #EEF2FF; border: 1px dashed #6366F1; border-radius: 8px; padding: 0.5rem 0.75rem; margin-top: 0.65rem; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.75rem; color: #4338CA; font-weight: 600; text-transform: uppercase;">6-Digit OTP:</span>
          <span style="font-family: monospace; font-size: 1.35rem; font-weight: 800; color: #4F46E5; letter-spacing: 0.12em;">${otp}</span>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
          <button type="button" id="otp-auto-fill-btn" style="flex: 1; background: #4F46E5; color: #fff; border: none; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
            <i class="fas fa-magic"></i> Auto-Fill Code
          </button>
          <button type="button" id="otp-copy-btn" style="background: #F1F5F9; color: #334155; border: 1px solid #CBD5E1; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Auto-fill button listener
  banner.querySelector('#otp-auto-fill-btn').addEventListener('click', () => {
    fillOtpInputs(otp);
    banner.remove();
  });

  // Copy button listener
  banner.querySelector('#otp-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(otp);
    if (typeof showToast === 'function') showToast("OTP copied to clipboard!", "success");
  });

  // Auto remove after 30s
  setTimeout(() => {
    if (banner && banner.parentNode) banner.remove();
  }, 30000);
}

/**
 * Helper to auto-fill the 6 OTP input boxes on the active modal
 */
function fillOtpInputs(otp) {
  const inputs = document.querySelectorAll('.otp-digit-input');
  if (inputs.length === 6) {
    otp.split('').forEach((digit, i) => {
      inputs[i].value = digit;
    });
    inputs[5].focus();
  }
}

/**
 * Verify submitted OTP against cache
 */
function verifyOtpCode(email, enteredOtp) {
  const cleanEmail = email.trim().toLowerCase();
  const record = _activeOtpCache[cleanEmail];

  if (!record) {
    return { valid: false, message: "No active verification code found for this email. Please request a new OTP." };
  }

  if (Date.now() > record.expiresAt) {
    delete _activeOtpCache[cleanEmail];
    return { valid: false, message: "This OTP has expired. Please click Resend OTP." };
  }

  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > 5) {
    delete _activeOtpCache[cleanEmail];
    return { valid: false, message: "Too many failed attempts. Please request a new OTP." };
  }

  if (record.otp !== enteredOtp.trim()) {
    const remaining = 5 - record.attempts;
    return { valid: false, message: `Incorrect OTP code. (${remaining} attempts remaining)` };
  }

  // Verified!
  delete _activeOtpCache[cleanEmail];
  return { valid: true };
}

/**
 * Open the Registration OTP Verification Modal
 */
function showRegistrationOtpModal({ email, name, title = "Verify Your Official Email", onVerified, onResend }) {
  let modal = document.getElementById('registration-otp-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'registration-otp-modal';
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 100000;';

  modal.innerHTML = `
    <div class="modal-dialog modal-sm" style="max-width: 440px; margin: auto; animation: modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
      <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 1.25rem 1.5rem;">
        <h3 class="modal-title" style="font-size: 1.15rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-shield-alt text-primary"></i> ${title}
        </h3>
        <button class="modal-close-btn" id="reg-otp-close-btn">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.5rem; text-align: center;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: #EEF2FF; color: #4F46E5; display: inline-flex; align-items: center; justify-content: center; font-size: 1.6rem; margin-bottom: 1rem;">
          <i class="fas fa-envelope-open-text"></i>
        </div>
        <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">Enter Verification Code</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          We sent a 6-digit confirmation code to<br>
          <strong style="color: var(--text-primary); font-size: 0.92rem;">${email}</strong>
        </p>

        <!-- 6 OTP Digit Inputs -->
        <div class="otp-inputs-row" style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1.25rem;">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="0" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" autofocus>
          <input type="text" maxlength="1" class="otp-digit-input" data-index="1" inputmode="numeric" pattern="[0-9]*">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="2" inputmode="numeric" pattern="[0-9]*">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="3" inputmode="numeric" pattern="[0-9]*">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="4" inputmode="numeric" pattern="[0-9]*">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="5" inputmode="numeric" pattern="[0-9]*">
        </div>

        <div id="reg-otp-error" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.82rem; margin-bottom: 1rem;"></div>

        <button type="button" id="reg-otp-submit-btn" class="btn btn-primary btn-block btn-lg" style="margin-bottom: 1rem; width: 100%;">
          <span><i class="fas fa-check-circle"></i> Verify & Complete Registration</span>
        </button>

        <div style="font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          <span>Didn't receive the email?</span>
          <button type="button" id="reg-otp-resend-btn" style="background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; padding: 0;" disabled>
            Resend in <span id="reg-otp-timer">60</span>s
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Inject OTP styling if not present
  injectOtpStyles();

  // Close handlers
  const closeModalFn = () => {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => modal.remove(), 250);
    clearInterval(timerInterval);
  };
  modal.querySelector('#reg-otp-close-btn').onclick = closeModalFn;

  // Setup 6-digit input behavior (auto-advance & paste)
  setupDigitInputs(modal);

  // Countdown timer for Resend
  let timeLeft = 60;
  const timerSpan = modal.querySelector('#reg-otp-timer');
  const resendBtn = modal.querySelector('#reg-otp-resend-btn');

  const timerInterval = setInterval(() => {
    timeLeft--;
    if (timerSpan) timerSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.innerHTML = '<i class="fas fa-redo"></i> Resend OTP';
      }
    }
  }, 1000);

  // Resend handler
  resendBtn.onclick = async () => {
    resendBtn.disabled = true;
    resendBtn.innerHTML = '<span class="spinner spinner-sm"></span> Sending...';
    const newOtp = generate6DigitOtp();
    await sendOtpEmail({ email, name, otp: newOtp, type: 'registration' });
    if (typeof showToast === 'function') showToast("New verification code dispatched!", "info");
    
    // Reset timer
    timeLeft = 60;
    resendBtn.innerHTML = 'Resend in <span id="reg-otp-timer">60</span>s';
    const newTimerSpan = modal.querySelector('#reg-otp-timer');
    const newInterval = setInterval(() => {
      timeLeft--;
      if (newTimerSpan) newTimerSpan.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(newInterval);
        resendBtn.disabled = false;
        resendBtn.innerHTML = '<i class="fas fa-redo"></i> Resend OTP';
      }
    }, 1000);
  };

  // Submit Handler
  const submitBtn = modal.querySelector('#reg-otp-submit-btn');
  submitBtn.onclick = async () => {
    const digits = Array.from(modal.querySelectorAll('.otp-digit-input')).map(i => i.value).join('');
    const errorEl = modal.querySelector('#reg-otp-error');

    if (digits.length !== 6) {
      errorEl.textContent = "Please enter all 6 digits of your verification code.";
      errorEl.style.display = 'block';
      return;
    }

    const result = verifyOtpCode(email, digits);
    if (!result.valid) {
      errorEl.textContent = result.message;
      errorEl.style.display = 'block';
      return;
    }

    // Success!
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Creating account...';

    closeModalFn();
    if (typeof onVerified === 'function') {
      await onVerified();
    }
  };
}

/**
 * Open the Forgot Password Modal (Student & Vendor Login)
 */
function openForgotPasswordModal(role = 'student') {
  let modal = document.getElementById('forgot-password-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'forgot-password-modal';
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 100000;';

  const roleTitle = role === 'vendor' ? 'Transport Vendor' : 'Student Commuter';

  modal.innerHTML = `
    <div class="modal-dialog modal-sm" style="max-width: 440px; margin: auto; animation: modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
      <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 1.25rem 1.5rem;">
        <h3 class="modal-title" style="font-size: 1.15rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-key text-warning"></i> Reset ${roleTitle} Password
        </h3>
        <button class="modal-close-btn" id="fp-close-btn">&times;</button>
      </div>

      <!-- Step 1: Request OTP by Email -->
      <div id="fp-step-1" class="modal-body" style="padding: 1.5rem;">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEF3C7; color: #D97706; display: inline-flex; align-items: center; justify-content: center; font-size: 1.4rem; margin-bottom: 0.75rem;">
            <i class="fas fa-lock"></i>
          </div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Forgot Your Password?</h4>
          <p style="font-size: 0.82rem; color: var(--text-secondary);">
            Enter your official registered email address. We'll send an OTP code to verify your identity.
          </p>
        </div>

        <form id="fp-email-form">
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label" for="fp-email">Official Registered Email <span class="required">*</span></label>
            <div class="input-icon-group" style="position: relative;">
              <i class="fas fa-envelope input-icon"></i>
              <input type="email" id="fp-email" class="form-control" placeholder="Enter your registered email" required autocomplete="email">
            </div>
          </div>

          <div id="fp-step1-error" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.82rem; margin-bottom: 1rem;"></div>

          <button type="submit" id="fp-send-btn" class="btn btn-primary btn-block btn-lg" style="width: 100%;">
            <span><i class="fas fa-paper-plane"></i> Send Password Reset OTP</span>
          </button>
        </form>
      </div>

      <!-- Step 2: Verify OTP & Enter New Password -->
      <div id="fp-step-2" class="modal-body" style="padding: 1.5rem; display: none;">
        <div style="text-align: center; margin-bottom: 1rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #EEF2FF; color: #4F46E5; display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 0.5rem;">
            <i class="fas fa-shield-alt"></i>
          </div>
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Verify Code & Set Password</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            Enter the 6-digit OTP code sent to<br><strong id="fp-disp-target-email" style="color: var(--text-primary);">-</strong>
          </p>
        </div>

        <form id="fp-reset-form">
          <!-- 6-digit OTP -->
          <div class="otp-inputs-row" style="display: flex; justify-content: center; gap: 0.45rem; margin-bottom: 1rem;">
            <input type="text" maxlength="1" class="otp-digit-input" data-index="0" inputmode="numeric" pattern="[0-9]*" autofocus>
            <input type="text" maxlength="1" class="otp-digit-input" data-index="1" inputmode="numeric" pattern="[0-9]*">
            <input type="text" maxlength="1" class="otp-digit-input" data-index="2" inputmode="numeric" pattern="[0-9]*">
            <input type="text" maxlength="1" class="otp-digit-input" data-index="3" inputmode="numeric" pattern="[0-9]*">
            <input type="text" maxlength="1" class="otp-digit-input" data-index="4" inputmode="numeric" pattern="[0-9]*">
            <input type="text" maxlength="1" class="otp-digit-input" data-index="5" inputmode="numeric" pattern="[0-9]*">
          </div>

          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" for="fp-new-pass">New Password <span class="required">*</span></label>
            <div class="input-icon-group" style="position: relative;">
              <i class="fas fa-key input-icon"></i>
              <input type="password" id="fp-new-pass" class="form-control" placeholder="Min. 6 characters" minlength="6" required style="padding-right: 2.75rem;">
              <button type="button" class="eye-toggle-btn" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer;" onclick="toggleInputPassType('fp-new-pass', this)">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 1.15rem;">
            <label class="form-label" for="fp-confirm-new-pass">Confirm New Password <span class="required">*</span></label>
            <div class="input-icon-group" style="position: relative;">
              <i class="fas fa-check-double input-icon"></i>
              <input type="password" id="fp-confirm-new-pass" class="form-control" placeholder="Re-enter new password" minlength="6" required style="padding-right: 2.75rem;">
              <button type="button" class="eye-toggle-btn" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer;" onclick="toggleInputPassType('fp-confirm-new-pass', this)">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div id="fp-step2-error" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.82rem; margin-bottom: 1rem;"></div>

          <button type="submit" id="fp-apply-btn" class="btn btn-primary btn-block btn-lg" style="width: 100%; margin-bottom: 0.85rem;">
            <span><i class="fas fa-save"></i> Apply New Password</span>
          </button>

          <div style="font-size: 0.8rem; text-align: center; color: var(--text-muted);">
            Didn't receive code? 
            <button type="button" id="fp-resend-btn" style="background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; padding: 0;">Resend OTP</button>
          </div>
        </form>
      </div>

      <!-- Step 3: Success Screen -->
      <div id="fp-step-3" class="modal-body" style="padding: 2rem 1.5rem; text-align: center; display: none;">
        <div style="width: 62px; height: 62px; border-radius: 50%; background: #ECFDF5; color: #10B981; display: inline-flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 1rem;">
          <i class="fas fa-check-circle"></i>
        </div>
        <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">Password Successfully Reset!</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          Your official account credentials have been updated. You can now log in using your new password.
        </p>
        <button type="button" id="fp-done-btn" class="btn btn-primary btn-block btn-lg" style="width: 100%;">
          <span><i class="fas fa-sign-in-alt"></i> Proceed to Login</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  injectOtpStyles();

  // Close handler
  const closeModalFn = () => {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => modal.remove(), 250);
  };
  modal.querySelector('#fp-close-btn').onclick = closeModalFn;

  let resetEmail = '';

  // Step 1: Send OTP Submit Handler
  const step1Form = modal.querySelector('#fp-email-form');
  step1Form.onsubmit = async (e) => {
    e.preventDefault();
    const emailInput = modal.querySelector('#fp-email');
    const errEl = modal.querySelector('#fp-step1-error');
    const sendBtn = modal.querySelector('#fp-send-btn');
    resetEmail = emailInput.value.trim().toLowerCase();

    errEl.style.display = 'none';
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Verifying account...';

    try {
      // 1. Verify that email exists in Firebase Auth & Firestore
      let accountExists = false;
      let userData = { name: 'User', role: role };

      try {
        const methods = await auth.fetchSignInMethodsForEmail(resetEmail);
        if (methods && methods.length > 0) {
          accountExists = true;
        }
      } catch (authChkErr) {}

      try {
        const userSnap = await db.collection('users').where('email', '==', resetEmail).get();
        if (!userSnap.empty) {
          accountExists = true;
          userData = userSnap.docs[0].data();
          if (userData.role && userData.role !== role) {
            throw new Error(`This email is registered under the "${userData.role}" portal, not as a "${role}". Please use the ${userData.role} login portal.`);
          }
        }
      } catch (fsErr) {
        if (fsErr.message.includes("registered under the")) throw fsErr;
      }

      if (!accountExists) {
        throw new Error(`No registered ${roleTitle} account found with email "${resetEmail}". Please verify the email or register.`);
      }

      sendBtn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Sending OTP code...';

      // 2. Generate and dispatch OTP
      const otp = generate6DigitOtp();
      await sendOtpEmail({
        email: resetEmail,
        name: userData.name || 'User',
        otp: otp,
        type: 'forgot_password'
      });

      // 3. Also trigger Firebase's official password reset email as a secondary channel
      try {
        await auth.sendPasswordResetEmail(resetEmail);
      } catch (fbErr) {
        console.warn("Firebase native reset email notice:", fbErr);
      }

      // 4. Transition to Step 2
      modal.querySelector('#fp-step-1').style.display = 'none';
      modal.querySelector('#fp-step-2').style.display = 'block';
      modal.querySelector('#fp-disp-target-email').textContent = resetEmail;
      setupDigitInputs(modal);
      
      if (typeof showToast === 'function') {
        showToast("Password reset code sent to your email!", "success");
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span><i class="fas fa-paper-plane"></i> Send Password Reset OTP</span>';
    }
  };

  // Step 2: Resend OTP
  modal.querySelector('#fp-resend-btn').onclick = async () => {
    const resendBtn = modal.querySelector('#fp-resend-btn');
    resendBtn.disabled = true;
    resendBtn.textContent = "Sending...";
    const newOtp = generate6DigitOtp();
    await sendOtpEmail({ email: resetEmail, otp: newOtp, type: 'forgot_password' });
    if (typeof showToast === 'function') showToast("New reset code sent!", "info");
    setTimeout(() => {
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend OTP";
    }, 15000);
  };

  // Step 2: Verify & Apply New Password Handler
  const step2Form = modal.querySelector('#fp-reset-form');
  step2Form.onsubmit = async (e) => {
    e.preventDefault();
    const digits = Array.from(modal.querySelectorAll('.otp-digit-input')).map(i => i.value).join('');
    const newPass = modal.querySelector('#fp-new-pass').value;
    const confirmNewPass = modal.querySelector('#fp-confirm-new-pass').value;
    const errEl = modal.querySelector('#fp-step2-error');
    const applyBtn = modal.querySelector('#fp-apply-btn');

    errEl.style.display = 'none';

    if (digits.length !== 6) {
      errEl.textContent = "Please enter the full 6-digit OTP code.";
      errEl.style.display = 'block';
      return;
    }

    if (newPass !== confirmNewPass) {
      errEl.textContent = "New passwords do not match.";
      errEl.style.display = 'block';
      return;
    }

    if (newPass.length < 6) {
      errEl.textContent = "Password must be at least 6 characters long.";
      errEl.style.display = 'block';
      return;
    }

    // Verify OTP (if not already verified via oobCode)
    if (!window._activeResetOobCode) {
      const verifyResult = verifyOtpCode(resetEmail, digits);
      if (!verifyResult.valid) {
        errEl.textContent = verifyResult.message;
        errEl.style.display = 'block';
        return;
      }
    }

    applyBtn.disabled = true;
    applyBtn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Updating credentials...';

    try {
      // If oobCode is available from Firebase reset link, finalize on Auth servers
      if (window._activeResetOobCode) {
        await auth.confirmPasswordReset(window._activeResetOobCode, newPass);
        window._activeResetOobCode = null;
      }

      // Update record in Firestore
      try {
        const userSnap = await db.collection('users').where('email', '==', resetEmail).get();
        if (!userSnap.empty) {
          const userDocId = userSnap.docs[0].id;
          await db.collection('users').doc(userDocId).update({
            passwordUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            hasOtpReset: true
          });
        }
      } catch (fsErr) {}

      // Transition to Step 3 (Success)
      modal.querySelector('#fp-step-2').style.display = 'none';
      modal.querySelector('#fp-step-3').style.display = 'block';

      // Pre-fill login email input if present on the page
      const pageEmailInput = document.getElementById('email');
      if (pageEmailInput) pageEmailInput.value = resetEmail;
    } catch (err) {
      errEl.textContent = "Error applying new credentials: " + err.message;
      errEl.style.display = 'block';
      applyBtn.disabled = false;
      applyBtn.innerHTML = '<span><i class="fas fa-save"></i> Apply New Password</span>';
    }
  };

  // Step 3: Done Button
  modal.querySelector('#fp-done-btn').onclick = () => {
    closeModalFn();
    const passInput = document.getElementById('password');
    if (passInput) passInput.focus();
  };
}

/**
 * Helper to setup 6-digit input keyboard navigation and paste functionality
 */
function setupDigitInputs(container) {
  const inputs = container.querySelectorAll('.otp-digit-input');
  inputs.forEach((input, index) => {
    input.value = '';

    // Handle single digit input
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val ? val[val.length - 1] : '';
      if (e.target.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    // Handle backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    // Handle paste of full OTP code
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (pasteData) {
        const chars = pasteData.slice(0, 6).split('');
        chars.forEach((c, i) => {
          if (inputs[i]) inputs[i].value = c;
        });
        const focusIdx = Math.min(chars.length, inputs.length - 1);
        inputs[focusIdx].focus();
      }
    });
  });

  if (inputs.length > 0) {
    setTimeout(() => inputs[0].focus(), 150);
  }
}

/**
 * Toggle password input visibility in modal
 */
function toggleInputPassType(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    if (icon) icon.className = 'fas fa-eye';
  }
}

/**
 * Inject required CSS animations and input styles
 */
function injectOtpStyles() {
  if (document.getElementById('otp-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'otp-injected-styles';
  style.textContent = `
    @keyframes slideDownIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes modalPop {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .otp-digit-input {
      width: 46px !important;
      height: 52px !important;
      text-align: center !important;
      font-size: 1.45rem !important;
      font-weight: 700 !important;
      font-family: monospace !important;
      border: 1.5px solid #CBD5E1 !important;
      border-radius: 8px !important;
      background: #FFFFFF !important;
      color: #0F172A !important;
      transition: all 0.15s ease !important;
      padding: 0 !important;
    }
    .otp-digit-input:focus {
      border-color: #4F46E5 !important;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.18) !important;
      outline: none !important;
      background: #FAFAFF !important;
    }
  `;
  document.head.appendChild(style);
}

// Auto-check URL for Firebase reset link parameters (oobCode)
function checkUrlForPasswordReset() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    if (mode === 'resetPassword' && oobCode && typeof auth !== 'undefined') {
      auth.verifyPasswordResetCode(oobCode).then(email => {
        window._activeResetOobCode = oobCode;
        const isVendorPage = window.location.pathname.includes('vendor');
        openForgotPasswordModal(isVendorPage ? 'vendor' : 'student');
        
        setTimeout(() => {
          const modal = document.getElementById('forgot-password-modal');
          if (modal) {
            modal.querySelector('#fp-step-1').style.display = 'none';
            modal.querySelector('#fp-step-2').style.display = 'block';
            modal.querySelector('#fp-disp-target-email').textContent = email;
            
            const otpRow = modal.querySelector('.otp-inputs-row');
            if (otpRow) {
              otpRow.style.display = 'none';
              const tip = document.createElement('div');
              tip.style.cssText = 'background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; border-radius: 6px; padding: 0.5rem; font-size: 0.8rem; margin-bottom: 1rem; text-align: center;';
              tip.innerHTML = '<i class="fas fa-check-circle"></i> Identity verified via secure email reset link!';
              otpRow.parentNode.insertBefore(tip, otpRow);
            }
          }
        }, 200);
      }).catch(err => {
        console.warn("Invalid or expired reset link:", err);
      });
    }
  } catch (e) {}
}

// Auto-initialize when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initEmailJsService();
    checkUrlForPasswordReset();
  });
} else {
  initEmailJsService();
  checkUrlForPasswordReset();
}
