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
      'pkg_starter_19': { icon: '🚀', gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', leadsCount: '5 Verified Leads', tag: 'STARTER KIT' },
      'pkg_kickstart_99': { icon: '⚡', gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', leadsCount: '25 Verified Leads', tag: 'POPULAR TIER' },
      'pkg_silver_299': { icon: '🔮', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', leadsCount: '75 Verified Leads', tag: 'HIGH EARNER' },
      'pkg_gold_699': { icon: '👑', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', leadsCount: '200 Hot Leads', tag: 'PRO MASTER' },
      'pkg_diamond_1499': { icon: '💎', gradient: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)', leadsCount: '500 VIP Leads', tag: 'VIP ELITE' }
    };

    container.innerHTML = data.packages.map(pkg => {
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
                <span><strong>${visual.leadsCount}</strong> (WhatsApp Click-to-Chat)</span>
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
                <span><strong>Lifetime ID & 1-Click Payouts</strong></span>
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
