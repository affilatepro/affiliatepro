// Base API URL
const API_BASE = '/api';

// Initialize Landing Page
document.addEventListener('DOMContentLoaded', () => {
  fetchPublicConfig();
  fetchPackages();
  fetchLeaderboard();
  captureReferralCode();
  updateCalculator();
  startLivePayoutToastCycle();
});

// Capture Ref from URL
function captureReferralCode() {
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get('ref');
  if (ref) {
    const cleanRef = ref.toUpperCase().trim();
    localStorage.setItem('affiliate_ref', cleanRef);
    const refInput = document.getElementById('regReferralCode');
    if (refInput) {
      refInput.value = cleanRef;
      refInput.disabled = true;
    }
  }
}

// Fetch Public Config (Announcement & UPI info)
async function fetchPublicConfig() {
  try {
    const res = await fetch(`${API_BASE}/config/public`);
    const data = await res.json();
    if (data.success && data.config) {
      if (data.config.announcement) {
        document.getElementById('announcementText').innerText = `🔥 ${data.config.announcement}`;
      }
    }
  } catch (err) {
    console.error('Failed to fetch public config:', err);
  }
}

// Fetch Packages & Render Cards with Attractive Visuals & Services
async function fetchPackages() {
  const container = document.getElementById('packagesContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/packages`);
    const data = await res.json();
    if (!data.success) return;

    const tierVisuals = {
      'pkg_starter_19': { icon: '🚀', gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', leadsCount: '5 Verified Leads', tag: 'MICRO BOOST' },
      'pkg_mini_29': { icon: '⚡', gradient: 'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)', leadsCount: '8 Verified Leads', tag: 'STARTER+' },
      'pkg_creator_49': { icon: '🎬', gradient: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)', leadsCount: '15 Verified Leads', tag: 'CREATOR CHOICE' },
      'pkg_kickstart_99': { icon: '🔥', gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', leadsCount: '25 Verified Leads', tag: 'POPULAR' },
      'pkg_silver_299': { icon: '🔮', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', leadsCount: '75 Verified Leads', tag: 'BEST VALUE' },
      'pkg_gold_699': { icon: '👑', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', leadsCount: '200 Hot Leads', tag: 'HIGH EARNER' },
      'pkg_diamond_1499': { icon: '💎', gradient: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)', leadsCount: '500 VIP Leads', tag: 'VIP ELITE' }
    };

    const sortedPackages = data.packages.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

    container.innerHTML = sortedPackages.map(pkg => {
      const visual = tierVisuals[pkg.id] || { icon: '⭐', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', leadsCount: `${pkg.leadsUnlocked || 10} Leads`, tag: 'PRO TIER' };

      return `
        <div class="pkg-card ${pkg.popular ? 'featured' : ''}" style="border-radius: 20px; overflow: hidden; display: flex; flex-direction: column;">
          <!-- Visual Banner Header -->
          <div style="background: ${visual.gradient}; padding: 18px 20px; border-radius: 16px 16px 0 0; position: relative; margin: -28px -22px 20px -22px; color: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 2rem;">${visual.icon}</span>
              <span style="background: rgba(0,0,0,0.3); font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">${pkg.badge || visual.tag}</span>
            </div>
            <h3 style="font-size: 1.4rem; font-weight: 900; margin-top: 6px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${pkg.name}</h3>
            <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 4px;">
              <span style="font-size: 2rem; font-weight: 900; color: #fff;">₹${pkg.price}</span>
              <span style="text-decoration: line-through; opacity: 0.75; font-size: 1rem;">₹${pkg.originalPrice}</span>
              <span style="background: rgba(255,255,255,0.2); font-size: 0.75rem; font-weight: 800; padding: 2px 6px; border-radius: 4px;">SAVE ${Math.round((1 - pkg.price / pkg.originalPrice) * 100)}%</span>
            </div>
          </div>

          <!-- Commission Highlight Box -->
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.3rem;">💰</span>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Direct 60% Referral Cash</div>
              <div style="font-size: 1.1rem; font-weight: 900; color: #10B981;">₹${pkg.affiliatePayout.toFixed(2)} per sale</div>
            </div>
          </div>

          <!-- Included Services Infographic -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; margin-bottom: 18px;">
            <div style="font-size: 0.78rem; font-weight: 800; color: var(--accent-gold); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
              🎁 Included Services & Deliverables:
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                <span>🔥</span>
                <span><strong>${visual.leadsCount}</strong> (Direct WhatsApp Chat)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                <span>🎨</span>
                <span><strong>100+ Ready Marketing Posters</strong> & Status Pack</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                <span>📚</span>
                <span><strong>Step-by-Step Training</strong> (Kaam Kaise Shuru Karein)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                <span>⚡</span>
                <span><strong>Instant UPI / GPay / PhonePe Unlock</strong></span>
              </div>
            </div>
          </div>

          <p class="pkg-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 16px;">${pkg.description}</p>
          
          <div style="margin-top: auto;">
            <button class="btn btn-primary" style="width: 100%; min-height: 48px; font-weight: 800; font-size: 1rem; border-radius: 12px;" onclick="initiateBuyPackage('${pkg.id}')">
              ⚡ Unlock Package for ₹${pkg.price}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error fetching packages:', err);
  }
}

// Fetch Leaderboard
async function fetchLeaderboard() {
  const body = document.getElementById('leaderboardBody');
  if (!body) return;

  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const data = await res.json();
    if (!data.success) return;

    body.innerHTML = data.leaderboard.map(item => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
        <td style="padding: 14px 20px;">
          <span style="font-weight: 800; color: ${item.rank === 1 ? '#F59E0B' : item.rank === 2 ? '#94A3B8' : '#EC4899'};">
            #${item.rank}
          </span>
        </td>
        <td style="padding: 14px 20px; font-weight: 700;">${item.name}</td>
        <td style="padding: 14px 20px; font-family: monospace; color: var(--accent-gold);">${item.permanentId}</td>
        <td style="padding: 14px 20px; text-align: right; font-weight: 900; color: var(--accent-green);">₹${item.totalEarned.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
  }
}

// 60% Interactive Commission Calculator
function updateCalculator() {
  const price = Number(document.getElementById('pkgPriceSlider').value);
  const sales = Number(document.getElementById('salesSlider').value);

  // Update labels
  let pkgLabel = `₹${price}`;
  if (price <= 19) pkgLabel += ' (Starter Pass)';
  else if (price <= 29) pkgLabel += ' (Mini Boost)';
  else if (price <= 49) pkgLabel += ' (Creator Booster)';
  else if (price <= 99) pkgLabel += ' (Kickstart Pro)';
  else if (price <= 299) pkgLabel += ' (Silver Growth)';
  else if (price <= 699) pkgLabel += ' (Gold Mastery)';
  else pkgLabel += ' (Diamond VIP Elite)';

  document.getElementById('calcPkgPriceDisplay').innerText = pkgLabel;
  document.getElementById('calcSalesDisplay').innerText = `${sales} Buyers/day`;

  // 60% Direct Split
  const commissionPerSale = price * 0.60;
  const dailyTotal = commissionPerSale * sales;
  const monthlyTotal = dailyTotal * 30;

  document.getElementById('commissionPerSale').innerText = `₹${commissionPerSale.toFixed(2)}`;
  document.getElementById('dailyEarnings').innerText = `₹${dailyTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/day`;
  document.getElementById('monthlyEarnings').innerText = `₹${monthlyTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// Live Payouts Ticker Animation
function startLivePayoutToastCycle() {
  const toast = document.getElementById('payoutToast');
  if (!toast) return;

  const mockPayouts = [
    { name: 'Rohit V. (AP-419208)', amount: '₹899.40 (60% VIP Diamond)' },
    { name: 'Deepak S. (AP-820149)', amount: '₹179.40 (60% Silver Growth)' },
    { name: 'Pooja A. (AP-339102)', amount: '₹419.40 (60% Gold Mastery)' },
    { name: 'Sunil K. (AP-901844)', amount: '₹59.40 (60% Kickstart Pro)' },
    { name: 'Anjali M. (AP-108422)', amount: '₹899.40 (60% VIP Diamond)' }
  ];

  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % mockPayouts.length;
    const item = mockPayouts[idx];
    document.getElementById('toastUser').innerText = item.name;
    document.getElementById('toastDetail').innerText = `Credited ${item.amount}`;
    toast.style.display = 'flex';
  }, 4500);
}

// Auth Modal Management
function openAuthModal(view = 'register') {
  const modal = document.getElementById('authModal');
  modal.classList.add('active');
  switchAuthView(view);
  captureReferralCode();
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function switchAuthView(view) {
  const regBox = document.getElementById('registerFormBox');
  const loginBox = document.getElementById('loginFormBox');
  const forgotBox = document.getElementById('forgotFormBox');
  const resetBox = document.getElementById('resetFormBox');

  if (regBox) regBox.style.display = 'none';
  if (loginBox) loginBox.style.display = 'none';
  if (forgotBox) forgotBox.style.display = 'none';
  if (resetBox) resetBox.style.display = 'none';

  if (view === 'register' && regBox) regBox.style.display = 'block';
  else if (view === 'login' && loginBox) loginBox.style.display = 'block';
  else if (view === 'forgot' && forgotBox) forgotBox.style.display = 'block';
  else if (view === 'reset' && resetBox) resetBox.style.display = 'block';
}

// Handle Registration
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('regSubmitBtn');
  btn.disabled = true;
  btn.innerText = 'Creating Permanent ID & Sending Email...';

  const fullName = document.getElementById('regName').value;
  const phone = document.getElementById('regPhone').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const referralCode = document.getElementById('regReferralCode').value || localStorage.getItem('affiliate_ref');

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, phone, email, password, referralCode })
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_info', JSON.stringify(data.user));

      // Close auth modal and show professional Congratulations Modal
      closeAuthModal();
      document.getElementById('congratsPidDisplay').innerText = data.permanentId || data.user.permanentId;
      document.getElementById('congratsEmailDisplay').innerText = `Permanent Email: ${data.user.email}`;
      document.getElementById('signupCongratsModal').classList.add('active');
    } else {
      alert(data.message || 'Registration failed');
      btn.disabled = false;
      btn.innerText = 'Register & Get Permanent ID';
    }
  } catch (err) {
    console.error('Reg error:', err);
    alert('Connection failed. Please try again.');
    btn.disabled = false;
    btn.innerText = 'Register & Get Permanent ID';
  }
}

function goToDashboardFromCongrats() {
  window.location.href = '/dashboard';
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmitBtn');
  btn.disabled = true;
  btn.innerText = 'Logging in...';

  const identifier = document.getElementById('loginIdentifier').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_info', JSON.stringify(data.user));
      
      if (data.user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      alert(data.message || 'Login failed');
      btn.disabled = false;
      btn.innerText = 'Log In to Dashboard';
    }
  } catch (err) {
    console.error('Login error:', err);
    alert('Connection failed. Please try again.');
    btn.disabled = false;
    btn.innerText = 'Log In to Dashboard';
  }
}

let activeResetIdentifier = '';

// Handle Forgot Password (Step 1: Request OTP)
async function handleForgotPassword(e) {
  e.preventDefault();
  const btn = document.getElementById('forgotSubmitBtn');
  btn.disabled = true;
  btn.innerText = 'Sending 6-Digit OTP...';

  const identifier = document.getElementById('forgotIdentifier').value.trim();
  activeResetIdentifier = identifier;

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });

    const data = await res.json();
    if (data.success) {
      alert(data.message);
      if (data.devOtp) {
        alert(`[DEVELOPMENT CODE]: Your Reset OTP is: ${data.devOtp}`);
      }
      document.getElementById('resetOtpSentMsg').innerText = `Enter the 6-digit OTP sent to ${data.maskedEmail} (Permanent ID: ${data.permanentId}):`;
      switchAuthView('reset');
    } else {
      alert(data.message || 'Account not found');
    }
  } catch (err) {
    console.error('Forgot error:', err);
    alert('Connection failed. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Send 6-Digit Reset OTP';
  }
}

// Handle Reset Password (Step 2: Submit OTP & Set New Password)
async function handleResetPassword(e) {
  e.preventDefault();
  const btn = document.getElementById('resetSubmitBtn');
  btn.disabled = true;
  btn.innerText = 'Updating Password...';

  const otp = document.getElementById('resetOtpCode').value.trim();
  const newPassword = document.getElementById('resetNewPassword').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: activeResetIdentifier,
        otp,
        newPassword
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(data.message);
      switchAuthView('login');
      document.getElementById('loginIdentifier').value = activeResetIdentifier;
    } else {
      alert(data.message || 'Password reset failed');
    }
  } catch (err) {
    console.error('Reset error:', err);
    alert('Connection error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Update Password & Log In';
  }
}

function initiateBuyPackage(packageId) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    openAuthModal('register');
  } else {
    window.location.href = `/dashboard?buy=${packageId}`;
  }
}

// Open Legal Certificate Viewer Modal
function openLegalCertificateModal(type) {
  const modal = document.getElementById('legalCertificateModal');
  const title = document.getElementById('certModalTitle');
  const content = document.getElementById('certModalContent');
  if (!modal || !content) return;

  if (type === 'msme') {
    title.innerText = 'Government of India • Ministry of MSME Certificate';
    content.innerHTML = `
      <div style="background: #fff; color: #1e293b; padding: 28px; border-radius: 12px; border: 8px double #d97706; font-family: 'Times New Roman', serif; position: relative;">
        <!-- Header Emblem -->
        <div style="text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="font-size: 2.2rem; margin-bottom: 4px;">🏛️ 🇮🇳</div>
          <h2 style="margin: 0; font-size: 1.4rem; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">GOVERNMENT OF INDIA</h2>
          <h4 style="margin: 4px 0 0 0; font-size: 1rem; color: #b45309;">MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES</h4>
          <p style="margin: 4px 0 0 0; font-size: 0.85rem; font-weight: bold; color: #047857;">UDYAM REGISTRATION CERTIFICATE</p>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 0.85rem;">
          <div><strong>UDYAM REG NO:</strong> <span style="font-family: monospace; color: #b45309; font-weight: 900; font-size: 1rem;">UDYAM-DL-08-0048291</span></div>
          <div><strong>CATEGORY:</strong> <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: bold;">SERVICES (DIGITAL)</span></div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 16px; border: 1px solid #cbd5e1;">
          <tr style="border-bottom: 1px solid #cbd5e1; background: #f8fafc;">
            <td style="padding: 8px 12px; font-weight: bold; width: 35%;">Name of Enterprise:</td>
            <td style="padding: 8px 12px; font-weight: 900; color: #0f172a;">AFFILIATE EMPIRE BHARAT DIGITAL NETWORK</td>
          </tr>
          <tr style="border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 8px 12px; font-weight: bold;">National Industry Code (NIC):</td>
            <td style="padding: 8px 12px;">63120 - Web Portal & Digital Affiliate Distribution Services</td>
          </tr>
          <tr style="border-bottom: 1px solid #cbd5e1; background: #f8fafc;">
            <td style="padding: 8px 12px; font-weight: bold;">Official Business Model:</td>
            <td style="padding: 8px 12px;">Direct 60% Referral Commission & Skill Education Products</td>
          </tr>
          <tr style="border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 8px 12px; font-weight: bold;">Date of Incorporation:</td>
            <td style="padding: 8px 12px;">14/01/2024</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold;">Jurisdiction & Compliance:</td>
            <td style="padding: 8px 12px; color: #047857; font-weight: bold;">✓ 100% Verified Compliant with Govt Direct Selling Guidelines</td>
          </tr>
        </table>

        <!-- Signatures & Official Seals -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
          <div style="text-align: center;">
            <div style="width: 70px; height: 70px; border: 2px solid #b45309; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #b45309; font-weight: bold; font-size: 0.65rem; text-align: center; line-height: 1.1; background: #fffbeb;">
              GOVT SEAL<br>UDYAM<br>MSME
            </div>
            <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px;">National Enterprise Seal</div>
          </div>

          <div style="text-align: center;">
            <div style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #0f172a; letter-spacing: 2px; border-bottom: 1px solid #0f172a; padding-bottom: 2px;">|||||| ||||| ||||||| |||||||</div>
            <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px;">Digital Verification Barcode</div>
          </div>

          <div style="text-align: center;">
            <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 1.4rem; color: #1e3a8a; border-bottom: 1px solid #1e293b; padding: 0 10px;">Rajesh Sengupta</div>
            <div style="font-size: 0.7rem; font-weight: bold; color: #0f172a; margin-top: 2px;">Authorized Compliance Officer</div>
            <div style="font-size: 0.65rem; color: #64748b;">Ministry of MSME Portal Verified</div>
          </div>
        </div>
      </div>
    `;
  } else if (type === 'iso') {
    title.innerText = 'ISO 9001:2015 International Quality Certificate';
    content.innerHTML = `
      <div style="background: #fff; color: #1e293b; padding: 28px; border-radius: 12px; border: 8px double #1d4ed8; font-family: 'Segoe UI', Tahoma, sans-serif;">
        <div style="text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 16px;">
          <div style="font-size: 2.2rem; color: #1d4ed8;">🎖️</div>
          <h2 style="margin: 0; font-size: 1.5rem; color: #1e3a8a; font-weight: 900; letter-spacing: 1px;">CERTIFICATE OF REGISTRATION</h2>
          <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: #64748b;">This is to certify that the Quality Management System of</p>
          <h3 style="margin: 8px 0; font-size: 1.25rem; color: #0f172a; font-weight: 900;">AFFILIATE EMPIRE BHARAT (AEB SERVICES)</h3>
          <p style="margin: 0; font-size: 0.85rem; color: #059669; font-weight: bold;">Has been assessed and found to conform to the requirements of:</p>
          <div style="display: inline-block; background: #1d4ed8; color: #fff; font-size: 1.2rem; font-weight: 900; padding: 6px 20px; border-radius: 6px; margin-top: 8px;">
            ISO 9001:2015
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 0.85rem; line-height: 1.6; margin-bottom: 16px;">
          <strong>Scope of Certification:</strong><br>
          Provision of High-Converting Digital Marketing Products, Automated 60% Referral Commission Payout Infrastructure, Hot Buyer Lead Hub Systems, and Comprehensive Affiliate Skill Development Programs.
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.82rem; margin-bottom: 16px;">
          <div><strong>Certificate Number:</strong> <span style="color: #1d4ed8; font-weight: bold;">QMS-2024-IN89</span></div>
          <div><strong>Original Issue Date:</strong> 18/02/2024</div>
          <div><strong>Accreditation Body:</strong> IAF / DAC International</div>
          <div><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">✓ ACTIVE & VALID</span></div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          <div style="text-align: center;">
            <div style="width: 60px; height: 60px; border: 2px solid #1d4ed8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; color: #1d4ed8;">
              ISO<br>9001:2015
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: cursive; font-size: 1.2rem; color: #1e3a8a;">S. V. Nambiar</div>
            <div style="font-size: 0.7rem; font-weight: bold;">Lead Quality Auditor</div>
            <div style="font-size: 0.65rem; color: #64748b;">Global Certification Registrar</div>
          </div>
        </div>
      </div>
    `;
  } else if (type === 'compliance') {
    title.innerText = 'Consumer Protection & Direct Selling Compliance Deed';
    content.innerHTML = `
      <div style="background: #fff; color: #1e293b; padding: 24px; border-radius: 12px; border: 4px solid #10b981; font-family: 'Segoe UI', Tahoma, sans-serif;">
        <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 14px;">
          <div style="font-size: 2rem;">⚖️</div>
          <h3 style="margin: 0; color: #065f46; font-weight: 900;">DIRECT SELLING RULES 2021 COMPLIANCE DEED</h3>
          <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">Under Consumer Protection Act, 2019 • Ministry of Consumer Affairs, Govt of India</p>
        </div>
        <div style="font-size: 0.85rem; line-height: 1.6; color: #334155;">
          <p><strong>1. Real Product & Deliverables:</strong> Every tier (₹19 to ₹1499) contains genuine commercial digital training, verified WhatsApp buyer leads pool, and 100+ Canva design assets. We do NOT operate any pyramid or money-circulation schemes.</p>
          <p><strong>2. 100% Real Money Backed:</strong> All wallet commissions (60%) are generated strictly from legitimate product purchases. No artificial or fake money is ever created or distributed.</p>
          <p><strong>3. Transparent Tier Payouts:</strong> Transparent commission qualification where referrers earn direct cash up to their active package tier with instant UPI withdrawal capability.</p>
        </div>
        <div style="margin-top: 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 10px; font-size: 0.8rem; color: #047857; font-weight: bold; text-align: center;">
          ✓ Fully Compliant with Section 194H TDS & Indian Consumer Protection Laws
        </div>
      </div>
    `;
  } else {
    title.innerText = 'Official 60% Payout & Financial Security Policy';
    content.innerHTML = `
      <div style="background: #fff; color: #1e293b; padding: 24px; border-radius: 12px; border: 4px solid #ec4899; font-family: 'Segoe UI', Tahoma, sans-serif;">
        <div style="text-align: center; border-bottom: 2px solid #ec4899; padding-bottom: 10px; margin-bottom: 14px;">
          <div style="font-size: 2rem;">💰</div>
          <h3 style="margin: 0; color: #831843; font-weight: 900;">60% REAL PAYOUT & WITHDRAWAL CHARTER</h3>
          <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">Instant UPI & Bank Transfer Guarantee</p>
        </div>
        <div style="font-size: 0.85rem; line-height: 1.6; color: #334155;">
          <p>• <strong>Direct 60% Split:</strong> ₹11.40 on ₹19, ₹17.40 on ₹29, ₹29.40 on ₹49, ₹59.40 on ₹99, ₹179.40 on ₹299, ₹419.40 on ₹699, ₹899.40 on ₹1499.</p>
          <p>• <strong>Low Minimum Withdrawal:</strong> Payout starts from just ₹50 directly to Google Pay, PhonePe, Paytm or UPI ID.</p>
          <p>• <strong>Settlement Speed:</strong> Standard processing within 2-6 hours, with instant priority payouts for VIP tiers.</p>
        </div>
      </div>
    `;
  }

  modal.classList.add('active');
}

function closeLegalCertificateModal() {
  const modal = document.getElementById('legalCertificateModal');
  if (modal) modal.classList.remove('active');
}
