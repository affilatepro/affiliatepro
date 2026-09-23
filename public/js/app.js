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

// Fetch Packages & Render Cards
async function fetchPackages() {
  const container = document.getElementById('packagesContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/packages`);
    const data = await res.json();
    if (!data.success) return;

    container.innerHTML = data.packages.map(pkg => `
      <div class="pkg-card ${pkg.popular ? 'featured' : ''}">
        ${pkg.badge ? `<span class="pkg-badge">${pkg.badge}</span>` : ''}
        <div class="pkg-header">
          <h3 class="pkg-title">${pkg.name}</h3>
          <div class="pkg-price-row">
            <span class="pkg-price">₹${pkg.price}</span>
            <span class="pkg-old-price">₹${pkg.originalPrice}</span>
          </div>
          <span class="pkg-commission-pill">⚡ Earn 60% (₹${pkg.affiliatePayout.toFixed(2)}) / referral</span>
        </div>
        <p class="pkg-desc">${pkg.description}</p>
        <ul class="pkg-features">
          ${pkg.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
        <button class="btn btn-primary" style="width: 100%;" onclick="initiateBuyPackage('${pkg.id}')">
          Unlock for ₹${pkg.price}
        </button>
      </div>
    `).join('');
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
  if (view === 'register') {
    document.getElementById('registerFormBox').style.display = 'block';
    document.getElementById('loginFormBox').style.display = 'none';
  } else {
    document.getElementById('registerFormBox').style.display = 'none';
    document.getElementById('loginFormBox').style.display = 'block';
  }
}

// Handle Registration
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('regSubmitBtn');
  btn.disabled = true;
  btn.innerText = 'Creating Permanent ID...';

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
      window.location.href = '/dashboard';
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

function initiateBuyPackage(packageId) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    openAuthModal('register');
  } else {
    window.location.href = `/dashboard?buy=${packageId}`;
  }
}
