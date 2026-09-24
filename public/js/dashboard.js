const API_BASE = '/api';
let currentUser = null;
let currentActivePackage = null;
let currentOrderId = null;
let currentLeads = [];

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    window.location.href = '/';
    return;
  }

  loadUserData();
  loadPackages();
  loadLeads();
  loadWallet();
  loadLeaderboard();
  init100PostersStudio();

  // Check if redirected to buy package
  const urlParams = new URLSearchParams(window.location.search);
  const buyPkgId = urlParams.get('buy');
  if (buyPkgId) {
    setTimeout(() => initiateBuyPackage(buyPkgId), 500);
  }
});

// Load User Data & Profile
async function loadUserData() {
  const token = localStorage.getItem('auth_token');
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) {
      handleLogout();
      return;
    }

    currentUser = data.user;
    currentActivePackage = data.activePackage;

    // Update UI elements
    document.getElementById('userGreetingName').innerText = currentUser.fullName.split(' ')[0];
    document.getElementById('sidebarPermanentId').innerText = currentUser.permanentId;
    
    const refUrl = `${window.location.origin}/?ref=${currentUser.permanentId}`;
    document.getElementById('dashboardRefLink').value = refUrl;

    // Update Metrics
    document.getElementById('cardWalletBalance').innerText = `₹${(currentUser.walletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('cardTotalEarned').innerText = `₹${(currentUser.totalEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('cardTotalReferrals').innerText = `${currentUser.referralCount || 0} Users`;

    // Dynamic Tier Status & Commission Eligibility Rules
    const tierHeading = document.getElementById('tierStatusHeading');
    const tierExplain = document.getElementById('tierStatusExplanation');

    if (currentActivePackage) {
      document.getElementById('cardActiveTier').innerText = currentActivePackage.name;
      document.getElementById('cardActiveTier').style.color = currentActivePackage.color || '#F59E0B';
      document.getElementById('sidebarPackageName').innerHTML = `Package: <span style="color: ${currentActivePackage.color || '#10B981'}; font-weight: 800;">${currentActivePackage.name}</span>`;
      document.getElementById('lockedAccountBanner').style.display = 'none';

      if (currentActivePackage.price === 19) {
        if (tierHeading) tierHeading.innerHTML = `⭐ Active Tier: ₹19 Starter Pass (Earn ₹11.40/sale)`;
        if (tierExplain) tierExplain.innerHTML = `✅ Aap ₹19 packages par <strong>60% (₹11.40)</strong> direct commission kamate hain.<br>⚠️ Agar aapka referral ₹29 ya higher package buy karega, toh commission <strong>₹11.40</strong> par cap rahega. Higher 60% payouts unlock karne ke liye ₹29+ package upgrade karein!`;
      } else if (currentActivePackage.price === 29) {
        if (tierHeading) tierHeading.innerHTML = `⚡ Active Tier: ₹29 Mini Boost (Earn ₹11.40 & ₹17.40/sale)`;
        if (tierExplain) tierExplain.innerHTML = `✅ Aap ₹19 (₹11.40) aur ₹29 (₹17.40) dono par <strong>60% direct cash</strong> kamate hain.<br>⚠️ ₹49+ packages par commission <strong>₹17.40</strong> par cap rahega. Higher commission ke liye Creator Booster / Kickstart Pro upgrade karein!`;
      } else if (currentActivePackage.price === 49) {
        if (tierHeading) tierHeading.innerHTML = `🎬 Active Tier: ₹49 Creator Booster (Earn ₹11.40, ₹17.40 & ₹29.40/sale)`;
        if (tierExplain) tierExplain.innerHTML = `✅ Aap ₹19 (₹11.40), ₹29 (₹17.40) aur ₹49 (₹29.40) teeno par <strong>60% direct cash</strong> kamate hain.<br>⚠️ ₹99+ packages par commission <strong>₹29.40</strong> par cap rahega. Full commission ke liye Kickstart Pro / Silver upgrade karein!`;
      } else {
        if (tierHeading) tierHeading.innerHTML = `👑 Active Tier: ${currentActivePackage.name} (Max Payout: ₹${currentActivePackage.affiliatePayout}/sale)`;
        if (tierExplain) tierExplain.innerHTML = `✅ Aap ₹19 se lekar ₹${currentActivePackage.price} tak ke sabhi packages par full <strong>60% Direct Instant Commission</strong> kamane ke liye eligible hain!`;
      }
    } else {
      document.getElementById('cardActiveTier').innerText = 'Locked (Free ID)';
      document.getElementById('cardActiveTier').style.color = '#ef4444';
      document.getElementById('sidebarPackageName').innerHTML = `Package: <span style="color: #ef4444; font-weight: 700;">Locked (Free)</span>`;
      document.getElementById('lockedAccountBanner').style.display = 'flex';
      if (tierHeading) tierHeading.innerHTML = `🔒 Free ID Registered • Commission Currently Locked (₹0)`;
      if (tierExplain) tierExplain.innerHTML = `⚠️ Aapne abhi tak koi package activate nahi kiya hai. Apne wallet me 60% instant commissions unlock karne ke liye kam se kam <strong>₹19 Starter Pass</strong> activate karein!`;
    }

    // Downline Team
    if (data.downlineStats) {
      renderDownlineTeam(data.downlineStats);
    }

    // Generate Marketing Poster, Official Partner ID Card & Verified Partner Certificate (Resilient)
    try { generateMarketingPoster(); } catch (e) { console.warn('Poster gen non-fatal:', e); }
    try { renderOfficialIdCard(); } catch (e) { console.warn('ID Card gen non-fatal:', e); }
    try { renderOfficialPartnerCertificate(); } catch (e) { console.warn('Cert gen non-fatal:', e); }

    // Re-render packages with user's active tier status highlighted
    loadPackages();

  } catch (err) {
    console.error('Error loading user data:', err);
  }
}

// Render Downline Table
function renderDownlineTeam(stats) {
  document.getElementById('downlineSummaryCount').innerText = `${stats.totalReferrals} Direct Users (${stats.activeReferrals} Active)`;
  const tbody = document.getElementById('downlineTableBody');
  if (!tbody) return;

  if (!stats.downlineList || stats.downlineList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-dim);">No referrals yet. Share your link to start earning 60% direct cash!</td></tr>`;
    return;
  }

  tbody.innerHTML = stats.downlineList.map(u => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 10px 14px; color: var(--text-muted);">${new Date(u.createdAt).toLocaleDateString()}</td>
      <td style="padding: 10px 14px; font-family: monospace; color: var(--accent-gold);">${u.permanentId}</td>
      <td style="padding: 10px 14px; font-weight: 700;">${u.fullName}</td>
      <td style="padding: 10px 14px;">
        <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.08);">
          ${u.packageName}
        </span>
      </td>
      <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: var(--accent-green);">
        +₹${u.commissionEarned.toFixed(2)}
      </td>
    </tr>
  `).join('');
}

let currentPosterTheme = 'gold';
let currentSelectedTemplate = null;

// Load Packages into Dashboard Store with Rich Visuals & Included Services
async function loadPackages() {
  const container = document.getElementById('dashboardPackagesGrid');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/packages`);
    const data = await res.json();
    if (!data.success) return;

    const activePkgId = currentUser && currentUser.activePackageId;

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
      const isActive = activePkgId === pkg.id;
      const visual = tierVisuals[pkg.id] || { icon: '⭐', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', leadsCount: `${pkg.leadsUnlocked || 10} Leads`, tag: 'PRO TIER' };
      const payoutFormatted = (Number(pkg.affiliatePayout) || ((Number(pkg.price) || 0) * 0.6)).toFixed(2);

      return `
        <div class="pkg-card ${isActive ? 'featured' : ''}" style="border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; ${isActive ? 'border: 2px solid #10B981; box-shadow: 0 0 25px rgba(16,185,129,0.35);' : ''}">
          <!-- Visual Banner Header -->
          <div style="background: ${isActive ? 'linear-gradient(135deg, #10B981 0%, #047857 100%)' : visual.gradient}; padding: 18px 20px; border-radius: 16px 16px 0 0; position: relative; margin: -28px -22px 20px -22px; color: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 2rem;">${visual.icon}</span>
              <span style="background: rgba(0,0,0,0.35); font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase;">
                ${isActive ? '✓ YOUR ACTIVE PLAN' : (pkg.badge || visual.tag)}
              </span>
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
              <div style="font-size: 1.1rem; font-weight: 900; color: #10B981;">₹${payoutFormatted} per sale</div>
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
            ${isActive ? `
              <button class="btn btn-success" style="width: 100%; min-height: 48px; font-weight: 800; font-size: 1rem; border-radius: 12px;" disabled>
                ✓ Currently Active Plan
              </button>
            ` : `
              <button class="btn btn-primary" style="width: 100%; min-height: 48px; font-weight: 800; font-size: 1rem; border-radius: 12px;" onclick="initiateBuyPackage('${pkg.id}')">
                ⚡ Unlock for ₹${pkg.price}
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading packages:', err);
  }
}

// 100+ Poster Studio Engine
function init100PostersStudio() {
  render100PostersList('All');
  if (window.PROMO_TEMPLATES_100 && window.PROMO_TEMPLATES_100.length > 0) {
    currentSelectedTemplate = window.PROMO_TEMPLATES_100[0];
    generateMarketingPoster(currentSelectedTemplate);
  }
}

function filterPosterCategory(cat) {
  document.querySelectorAll('[id^="cat"]').forEach(b => b.classList.remove('active'));
  const btnMap = {
    'All': 'catAllBtn',
    'WhatsApp Status': 'catWaBtn',
    'Instagram Story': 'catInstaBtn',
    'Hindi Viral': 'catHindiBtn',
    'Sales Pitch': 'catSalesBtn'
  };
  if (btnMap[cat]) {
    const el = document.getElementById(btnMap[cat]);
    if (el) el.classList.add('active');
  }
  render100PostersList(cat);
}

function render100PostersList(cat) {
  const container = document.getElementById('postersGridContainer');
  if (!container || !window.PROMO_TEMPLATES_100) return;

  const filtered = cat === 'All' 
    ? window.PROMO_TEMPLATES_100 
    : window.PROMO_TEMPLATES_100.filter(t => t.cat === cat);

  container.innerHTML = filtered.map(item => `
    <div style="background: rgba(0,0,0,0.35); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; transition: var(--transition);" class="poster-item-card" onclick="selectPosterTemplate(${item.id})">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-weight: 800; font-size: 0.85rem; color: var(--accent-gold);">#${item.id} • ${item.title}</span>
        <span style="font-size: 0.7rem; color: var(--text-dim); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">${item.cat}</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; line-height: 1.4;">${item.text.replace('[LINK]', `${window.location.origin}/?ref=${currentUser ? currentUser.permanentId : 'ID'}`)}</p>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 4px 10px;" onclick="event.stopPropagation(); copyCustomPromoScript('${encodeURIComponent(item.text)}')">📋 Copy Script</button>
        <button class="btn btn-primary btn-sm" style="font-size: 0.75rem; padding: 4px 10px;" onclick="event.stopPropagation(); selectPosterTemplate(${item.id})">👁️ Preview Poster</button>
      </div>
    </div>
  `).join('');
}

function selectPosterTemplate(id) {
  if (!window.PROMO_TEMPLATES_100) return;
  const tmpl = window.PROMO_TEMPLATES_100.find(t => t.id === id);
  if (tmpl) {
    currentSelectedTemplate = tmpl;
    generateMarketingPoster(tmpl);
  }
}

function setPosterTheme(theme) {
  currentPosterTheme = theme;
  document.querySelectorAll('[id^="theme"]').forEach(b => b.classList.remove('active'));
  const btnMap = {
    'gold': 'themeGoldBtn',
    'emerald': 'themeEmeraldBtn',
    'purple': 'themePurpleBtn',
    'sunset': 'themeSunsetBtn'
  };
  if (btnMap[theme]) {
    const el = document.getElementById(btnMap[theme]);
    if (el) el.classList.add('active');
  }
  generateMarketingPoster(currentSelectedTemplate);
}

// Generate Customized Branded Marketing Poster (Canvas)
function generateMarketingPoster(template) {
  const canvas = document.getElementById('posterCanvas');
  if (!canvas || !currentUser) return;

  const ctx = canvas.getContext('2d');
  
  // Theme Color Palettes
  let bgGrad1 = '#0a0f1d', bgGrad2 = '#111827', accentColor = '#F59E0B', subAccent = '#10B981';
  if (currentPosterTheme === 'emerald') {
    bgGrad1 = '#022c22'; bgGrad2 = '#064e3b'; accentColor = '#34D399'; subAccent = '#FBBF24';
  } else if (currentPosterTheme === 'purple') {
    bgGrad1 = '#1e1b4b'; bgGrad2 = '#312e81'; accentColor = '#C084FC'; subAccent = '#38BDF8';
  } else if (currentPosterTheme === 'sunset') {
    bgGrad1 = '#431407'; bgGrad2 = '#7c2d12'; accentColor = '#FB923C'; subAccent = '#FDE047';
  }

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 600, 750);
  grad.addColorStop(0, bgGrad1);
  grad.addColorStop(0.5, bgGrad2);
  grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 750);

  // Border Accent
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 576, 726);

  // Header Brand Tag
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('👑 AFFILIATE EMPIRE BHARAT', 300, 55);

  // Main Headline
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 32px sans-serif';
  ctx.fillText('EARN 60% COMMISSION', 300, 105);
  ctx.fillText('DIRECTLY INTO YOUR UPI!', 300, 145);

  // Dynamic Selected Template Hook Box
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(40, 175, 520, 110);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 175, 520, 110);

  ctx.fillStyle = subAccent;
  ctx.font = 'bold 18px sans-serif';
  const tmplTitle = template ? template.title : 'Mobile Daily Income Program';
  ctx.fillText(`⚡ ${tmplTitle}`, 300, 205);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '15px sans-serif';
  ctx.fillText('• Packages Start From ₹19 to ₹1499 Only', 300, 235);
  ctx.fillText('• Verified Hot Buyer Leads with WhatsApp Numbers Included', 300, 260);

  // User Permanent ID Badge
  ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.fillRect(90, 305, 420, 80);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(90, 305, 420, 80);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px sans-serif';
  ctx.fillText('OFFICIAL PARTNER PERMANENT ID', 300, 332);

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 30px monospace';
  ctx.fillText(currentUser.permanentId, 300, 368);

  // QR Code Area
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(210, 410, 180, 180);

  // Draw QR code onto canvas
  const qrDiv = document.createElement('div');
  new QRCode(qrDiv, {
    text: `${window.location.origin}/?ref=${currentUser.permanentId}`,
    width: 160,
    height: 160
  });

  setTimeout(() => {
    const qrCanvas = qrDiv.querySelector('canvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 220, 420, 160, 160);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Scan to Register & Get Free Access', 300, 625);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px sans-serif';
    ctx.fillText('100% Genuine Direct Commission Platform', 300, 660);

    ctx.fillStyle = subAccent;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('⚡ Instant ₹50 Minimum UPI Withdrawal', 300, 690);
  }, 200);
}

function downloadPoster() {
  const canvas = document.getElementById('posterCanvas');
  const link = document.createElement('a');
  link.download = `Affiliate_Poster_${currentUser ? currentUser.permanentId : 'Pro'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function copyCustomPromoScript(encodedText) {
  const text = decodeURIComponent(encodedText);
  const refUrl = `${window.location.origin}/?ref=${currentUser ? currentUser.permanentId : ''}`;
  const script = text.replace(/\[LINK\]/g, refUrl) + `\n\n(Permanent Partner ID: ${currentUser ? currentUser.permanentId : ''})`;
  navigator.clipboard.writeText(script);
  alert('Promotional script copied to clipboard! Paste directly on your WhatsApp Status / Instagram Story.');
}

// Initiate Package Purchase & Open Dynamic UPI Modal
async function initiateBuyPackage(packageId) {
  const token = localStorage.getItem('auth_token');
  try {
    const res = await fetch(`${API_BASE}/packages/purchase-init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ packageId })
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Could not initiate purchase');
      return;
    }

    currentOrderId = data.order.id;
    const payment = data.paymentDetails;

    // Populate Modal with real merchant details
    document.getElementById('payModalPkgName').innerText = data.order.packageName;
    document.getElementById('payModalAmount').innerText = `₹${payment.amount}`;
    
    // Set 1-Click UPI Deep-links for Mobile Apps
    document.getElementById('directUpiPayLink').href = payment.upiUri;
    document.getElementById('gpayDirectBtn').href = payment.gpayUri || payment.upiUri;
    document.getElementById('phonepeDirectBtn').href = payment.phonepeUri || payment.upiUri;
    document.getElementById('paytmDirectBtn').href = payment.paytmUri || payment.upiUri;

    // Reset button state
    const btn = document.getElementById('completePaymentBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ I Have Paid • Activate Package & 60% Commission';
    }

    // Open Modal
    document.getElementById('paymentModal').classList.add('active');
  } catch (err) {
    console.error('Buy error:', err);
    alert('Failed to connect to payment engine.');
  }
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
}

function handleDirectAppClick(appName) {
  const btn = document.getElementById('completePaymentBtn');
  if (btn) {
    btn.innerText = `⏳ Processing via ${appName}... Click Here Once Paid`;
  }
}

// Complete Real Payment & Instant Package Unlock
async function completeRealPayment() {
  const btn = document.getElementById('completePaymentBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Verifying Transaction with Gateway...';
  }

  const token = localStorage.getItem('auth_token');

  try {
    const res = await fetch(`${API_BASE}/packages/purchase-submit-utr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ orderId: currentOrderId })
    });

    const data = await res.json();
    
    if (data.success) {
      alert(`🎉 Payment Successful! Your ${data.order.packageName} is now ACTIVE! 60% commission has been credited to your referrer.`);
      closePaymentModal();
      loadUserData();
      loadPackages();
      loadLeads();
      loadWallet();
    } else {
      alert(data.message || 'Payment confirmation failed');
      if (btn) {
        btn.disabled = false;
        btn.innerText = '⚡ I Have Paid • Activate Package & 60% Commission';
      }
    }
  } catch (err) {
    console.error('Payment complete error:', err);
    alert('Verification error. Please try again.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ I Have Paid • Activate Package & 60% Commission';
    }
  }
}

// Load Hot Leads
async function loadLeads() {
  const token = localStorage.getItem('auth_token');
  try {
    const res = await fetch(`${API_BASE}/leads`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    currentLeads = data.leads;
    document.getElementById('leadsAccessBadge').innerText = `${data.stats.unlockedCount} of ${data.stats.totalLeadsAvailable} Hot Leads Unlocked (${data.stats.activePackageName})`;
    renderLeads(currentLeads);
  } catch (err) {
    console.error('Error loading leads:', err);
  }
}

// Render Leads with 1-Click Smart Pitch Closer Bot
function renderLeads(leads) {
  const container = document.getElementById('leadsContainer');
  if (!container) return;

  if (leads.length === 0) {
    container.innerHTML = `<p style="color: var(--text-dim);">No leads match your search criteria.</p>`;
    return;
  }

  container.innerHTML = leads.map(lead => `
    <div class="lead-card">
      <div>
        <div class="lead-top">
          <div>
            <h4 class="lead-name">${lead.name}</h4>
            <div class="lead-city">📍 ${lead.city}</div>
          </div>
          <span class="interest-pill">${lead.interestScore}% Intent</span>
        </div>

        <div class="lead-details">
          <span><strong>Category:</strong> ${lead.category}</span>
          <span><strong>Budget:</strong> ${lead.budget}</span>
          <span><strong>Interest History:</strong> ${lead.pastInterest}</span>
          <span><strong>Phone:</strong> <span style="font-family: monospace; color: var(--accent-gold); font-weight: 700;">+91 ${lead.phone}</span></span>
        </div>
      </div>

      ${lead.isUnlocked ? `
        <div style="display: flex; gap: 8px; flex-direction: column;">
          <button class="btn btn-primary btn-sm" style="font-weight: 800; border-radius: 8px;" onclick="openPitchModal('${lead.id}')">
            🚀 1-Click Smart Pitch Closer
          </button>
          <a href="${lead.whatsappLink}" target="_blank" class="whatsapp-btn" style="text-align: center; padding: 8px;">
            💬 Direct WhatsApp Chat
          </a>
        </div>
      ` : `
        <div class="lead-locked-btn" onclick="scrollToPackages()">
          🔒 Locked • Upgrade Package to Unlock WhatsApp Contact
        </div>
      `}
    </div>
  `).join('');
}

let activePitchLead = null;
let activePitchTone = 'friendly_hindi';

function openPitchModal(leadId) {
  activePitchLead = currentLeads.find(l => l.id === leadId);
  if (!activePitchLead) return;

  activePitchTone = 'friendly_hindi';
  document.querySelectorAll('[id^="pitchTone"]').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('pitchToneFriendly');
  if (activeBtn) activeBtn.classList.add('active');

  generatePitchContent();
  document.getElementById('pitchModal').classList.add('active');
}

function closePitchModal() {
  document.getElementById('pitchModal').classList.remove('active');
}

function changePitchTone(tone) {
  activePitchTone = tone;
  document.querySelectorAll('[id^="pitchTone"]').forEach(b => b.classList.remove('active'));
  const toneMap = {
    'friendly_hindi': 'pitchToneFriendly',
    'urgent_deal': 'pitchToneUrgent',
    'student_earning': 'pitchToneStudent',
    'creator_pro': 'pitchTonePro'
  };
  if (toneMap[tone]) {
    const el = document.getElementById(toneMap[tone]);
    if (el) el.classList.add('active');
  }
  generatePitchContent();
}

function generatePitchContent() {
  if (!activePitchLead || !currentUser) return;

  const name = activePitchLead.name.split(' ')[0];
  const refUrl = `${window.location.origin}/?ref=${currentUser.permanentId}`;
  const pid = currentUser.permanentId;

  const toneTemplates = {
    'friendly_hindi': `Namaste ${name} ji! 🙏\n\nMaine dekha aap mobile phone se online part-time income me interested hain.\n\nHumara verified 60% Affiliate Commission platform live hai. Sirf ₹19 ya ₹49 se start karke aap daily ₹500-₹1500 directly apne UPI me kama sakte hain! 💸\n\n👉 Abhi join karke start karein:\n${refUrl}\n\n(Authorized Partner ID: ${pid})`,
    
    'urgent_deal': `🔥 Urgent Special Deal for ${name}!\n\nAaj sirf ₹19 - ₹49 me Affiliate Empire Bharat ka official partner banein aur har referral par 60% direct cash paayein!\n\n⚡ Minimum Withdrawal sirf ₹50 (Instant UPI)\n⚡ Ready-made Buyer Leads Pool Included\n\n👉 Abhi register karein:\n${refUrl}`,
    
    'student_earning': `Hey ${name}! 👋\n\nApne mobile phone ka use karke pocket money aur daily ₹500+ income generate karna chahte ho?\n\nZero inventory, direct 60% instant commission. Har friend ya contact ke join karne par instant paise aapke wallet me!\n\n🚀 Shuru karein:\n${refUrl}`,
    
    'creator_pro': `Hello ${name}! 🚀\n\nMonetize your WhatsApp status & Instagram audience with 60% lifetime affiliate payout.\n\n✅ 100+ Ready-made Canva Posters\n✅ Instant 60% Auto Payout Engine\n✅ Direct Hot Leads Stream\n\n👉 Access Platform:\n${refUrl}`
  };

  const text = toneTemplates[activePitchTone] || toneTemplates['friendly_hindi'];
  const textarea = document.getElementById('generatedPitchText');
  if (textarea) textarea.value = text;
}

function sendPitchWhatsApp() {
  if (!activePitchLead) return;
  const text = document.getElementById('generatedPitchText').value;
  const cleanPhone = activePitchLead.phone.replace(/\D/g, '');
  const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function copyPitchText() {
  const text = document.getElementById('generatedPitchText').value;
  navigator.clipboard.writeText(text);
  alert('Pitch message copied to clipboard!');
}

// Render Verified Official Partner ID Card (Canvas)
function renderOfficialIdCard() {
  const canvas = document.getElementById('idCardCanvas');
  if (!canvas || !currentUser) return;

  const ctx = canvas.getContext('2d');
  const pkgName = currentActivePackage ? currentActivePackage.name : 'Free Member';

  // Update DOM details
  const nameEl = document.getElementById('idCardHolderName');
  const pidEl = document.getElementById('idCardHolderPid');
  const tierEl = document.getElementById('idCardHolderTier');
  if (nameEl) nameEl.innerText = currentUser.fullName;
  if (pidEl) pidEl.innerText = currentUser.permanentId;
  if (tierEl) tierEl.innerText = pkgName;

  // Background Metallic Card
  const grad = ctx.createLinearGradient(0, 0, 600, 380);
  grad.addColorStop(0, '#0c1322');
  grad.addColorStop(0.5, '#1e293b');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 380);

  // Metallic Gold Border
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 580, 360);

  // Inner Subtle Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, 564, 344);

  // Header Banner
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('👑 BHARAT DIGITAL AFFILIATE COUNCIL', 35, 45);

  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('✓ OFFICIAL CERTIFIED PARTNER', 565, 45);

  // Horizontal line
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35, 58);
  ctx.lineTo(565, 58);
  ctx.stroke();

  // Partner Name & Details
  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AUTHORIZED PARTNER NAME:', 35, 95);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px sans-serif';
  ctx.fillText(currentUser.fullName.toUpperCase(), 35, 125);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px sans-serif';
  ctx.fillText('PERMANENT PARTNER ID:', 35, 160);

  ctx.fillStyle = '#F59E0B';
  ctx.font = '900 20px monospace';
  ctx.fillText(currentUser.permanentId, 35, 188);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px sans-serif';
  ctx.fillText('LICENSED TIER & COMMISSION:', 35, 225);

  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${pkgName.toUpperCase()} (60% Direct Payout)`, 35, 250);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px sans-serif';
  ctx.fillText(`MEMBER SINCE: ${new Date(currentUser.createdAt || Date.now()).toLocaleDateString()}`, 35, 290);
  ctx.fillText('STATUS: VERIFIED LIFETIME COMMERCIAL LICENSE', 35, 310);

  // Security Hologram / Stamp
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.beginPath();
  ctx.arc(490, 160, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICIAL', 490, 150);
  ctx.fillText('60% PAYOUT', 490, 166);
  ctx.fillText('VERIFIED', 490, 182);

  // Render QR Code onto Canvas
  const qrDiv = document.createElement('div');
  new QRCode(qrDiv, {
    text: `${window.location.origin}/?ref=${currentUser.permanentId}`,
    width: 100,
    height: 100
  });

  setTimeout(() => {
    const qrCanvas = qrDiv.querySelector('canvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 440, 240, 100, 100);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Scan to Connect', 490, 355);
    }
  }, 300);
}

function downloadIdCard() {
  const canvas = document.getElementById('idCardCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `Affiliate_ID_Card_${currentUser ? currentUser.permanentId : 'Pro'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function shareIdCardWhatsApp() {
  const refUrl = `${window.location.origin}/?ref=${currentUser ? currentUser.permanentId : ''}`;
  const text = encodeURIComponent(`🎖️ I am an Official Licensed Partner of Affiliate Empire Bharat!\n\nEarn 60% Direct Instant Cash on Every Referral.\nJoin with my link:\n👉 ${refUrl}\n\n(Permanent Partner ID: ${currentUser ? currentUser.permanentId : ''})`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

// Search & Filter Leads
function filterLeads() {
  const query = document.getElementById('leadSearchInput').value.toLowerCase();
  const filtered = currentLeads.filter(l => 
    l.name.toLowerCase().includes(query) ||
    l.city.toLowerCase().includes(query) ||
    l.category.toLowerCase().includes(query)
  );
  renderLeads(filtered);
}

// Load Wallet & Transactions
async function loadWallet() {
  const token = localStorage.getItem('auth_token');
  try {
    const res = await fetch(`${API_BASE}/wallet`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('payoutHistoryBody');
    if (!tbody) return;

    const allRecords = [
      ...data.withdrawals.map(w => ({ ...w, recordType: 'WITHDRAWAL' })),
      ...data.transactions.map(t => ({ ...t, recordType: 'LEDGER' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (allRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 16px; color: var(--text-dim);">No transactions yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allRecords.map(rec => {
      const isWithdrawal = rec.recordType === 'WITHDRAWAL';
      const isCommission = rec.type === 'REFERRAL_COMMISSION_60';
      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td style="padding: 8px 10px; color: var(--text-dim); font-size: 0.75rem;">${new Date(rec.createdAt).toLocaleDateString()}</td>
          <td style="padding: 8px 10px; font-size: 0.8rem;">${isWithdrawal ? `Payout via ${rec.paymentType}` : rec.description}</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 800; color: ${isCommission ? 'var(--accent-green)' : isWithdrawal ? '#ef4444' : '#fff'};">
            ${isWithdrawal ? `-₹${rec.amount}` : isCommission ? `+₹${rec.amount}` : `₹${rec.amount}`}
          </td>
          <td style="padding: 8px 10px; text-align: right;">
            <span class="status-tag ${rec.status ? rec.status.toLowerCase() : 'approved'}">${rec.status || 'COMPLETED'}</span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Wallet error:', err);
  }
}

// Toggle Payout input fields (UPI vs Bank)
function togglePayoutFields() {
  const type = document.getElementById('payoutType').value;
  if (type === 'BANK') {
    document.getElementById('upiPayoutFields').style.display = 'none';
    document.getElementById('bankPayoutFields').style.display = 'block';
  } else {
    document.getElementById('upiPayoutFields').style.display = 'block';
    document.getElementById('bankPayoutFields').style.display = 'none';
  }
}

// Handle Withdrawal Request
async function handleWithdrawal(e) {
  e.preventDefault();
  const amount = Number(document.getElementById('withdrawAmount').value);
  const paymentType = document.getElementById('payoutType').value;
  const upiId = document.getElementById('withdrawUpiId').value;
  const accountHolder = document.getElementById('bankHolder').value;
  const accountNumber = document.getElementById('bankAccNo').value;
  const ifscCode = document.getElementById('bankIfsc').value;

  const btn = document.getElementById('withdrawSubmitBtn');
  btn.disabled = true;
  btn.innerText = 'Submitting Request...';

  const token = localStorage.getItem('auth_token');

  try {
    const res = await fetch(`${API_BASE}/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount, paymentType, upiId, accountHolder, accountNumber, ifscCode
      })
    });

    const data = await res.json();
    alert(data.message);

    if (data.success) {
      document.getElementById('withdrawAmount').value = '';
      loadUserData();
      loadWallet();
    }
  } catch (err) {
    console.error('Withdraw error:', err);
    alert('Failed to submit withdrawal.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Submit Withdrawal Request';
  }
}

// Daily Spin & Win Game
async function triggerSpinWheel() {
  const token = localStorage.getItem('auth_token');
  const wheel = document.getElementById('spinWheelElement');
  const triggerBtn = document.getElementById('spinTriggerBtn');
  const resultMsg = document.getElementById('spinResultMsg');

  triggerBtn.style.pointerEvents = 'none';
  resultMsg.innerText = 'Spinning the wheel... Best of luck! 🤞';

  // Add rotation
  const randomDeg = 1440 + Math.floor(Math.random() * 360);
  wheel.style.transform = `rotate(${randomDeg}deg)`;

  try {
    const res = await fetch(`${API_BASE}/affiliate/spin`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    setTimeout(() => {
      if (data.success) {
        resultMsg.innerText = data.message;
        loadUserData();
        loadLeads();
        loadWallet();
      } else {
        resultMsg.innerText = data.message;
      }
      triggerBtn.style.pointerEvents = 'all';
    }, 4000);
  } catch (err) {
    console.error('Spin error:', err);
    resultMsg.innerText = 'Failed to spin. Try again later.';
    triggerBtn.style.pointerEvents = 'all';
  }
}

// Generate Customized Branded Marketing Poster (Canvas)
function generateMarketingPoster() {
  const canvas = document.getElementById('posterCanvas');
  if (!canvas || !currentUser) return;

  const ctx = canvas.getContext('2d');
  
  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 600, 750);
  grad.addColorStop(0, '#0a0f1d');
  grad.addColorStop(0.5, '#111827');
  grad.addColorStop(1, '#061325');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 750);

  // Border Accent
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 580, 730);

  // Header Text
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('👑 AFFILIATE EMPIRE BHARAT', 300, 60);

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 34px sans-serif';
  ctx.fillText('EARN 60% COMMISSION', 300, 115);
  ctx.fillText('DIRECTLY ON YOUR UPI!', 300, 160);

  // Key Features Pills
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('⚡ Packages Start from just ₹19 to ₹1499', 300, 215);
  ctx.fillText('📱 Instant WhatsApp Hot Buyer Leads Pool', 300, 250);
  ctx.fillText('💸 Same-Day UPI & Bank Withdrawals', 300, 285);

  // User Permanent ID Badge
  ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.fillRect(100, 320, 400, 80);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.strokeRect(100, 320, 400, 80);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px sans-serif';
  ctx.fillText('VERIFIED AFFILIATE PARTNER ID', 300, 350);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(currentUser.permanentId, 300, 385);

  // QR Code Area
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(210, 430, 180, 180);

  // Draw QR code onto canvas
  const qrDiv = document.createElement('div');
  new QRCode(qrDiv, {
    text: `${window.location.origin}/?ref=${currentUser.permanentId}`,
    width: 160,
    height: 160
  });

  setTimeout(() => {
    const qrCanvas = qrDiv.querySelector('canvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 220, 440, 160, 160);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Scan to Register & Get Free Access', 300, 645);

    ctx.fillStyle = '#64748B';
    ctx.font = '14px sans-serif';
    ctx.fillText('100% Genuine Digital Growth System', 300, 680);
  }, 300);
}

function downloadPoster() {
  const canvas = document.getElementById('posterCanvas');
  const link = document.createElement('a');
  link.download = `Affiliate_Poster_${currentUser ? currentUser.permanentId : 'Pro'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function copyPromoScript() {
  const refUrl = document.getElementById('dashboardRefLink').value;
  const script = `🔥 Ghar baithe apne mobile phone se daily ₹1000 - ₹3000 kamayein!\n\nZero stock, direct 60% instant commission on UPI.\nPackages start from ₹19 only.\n\nRegister with my Permanent ID (${currentUser ? currentUser.permanentId : ''}):\n👉 Click here: ${refUrl}`;
  navigator.clipboard.writeText(script);
  alert('Promotional script copied to clipboard! Paste directly on WhatsApp Status.');
}

// Load Leaderboard in Dashboard
async function loadLeaderboard() {
  const tbody = document.getElementById('dashLeaderboardBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const data = await res.json();
    if (!data.success) return;

    tbody.innerHTML = data.leaderboard.map(u => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
        <td style="padding: 14px 20px; font-weight: 800; color: ${u.rank === 1 ? '#F59E0B' : '#fff'};">#${u.rank}</td>
        <td style="padding: 14px 20px; font-weight: 700;">${u.name}</td>
        <td style="padding: 14px 20px; font-family: monospace; color: var(--accent-gold);">${u.permanentId}</td>
        <td style="padding: 14px 20px; text-align: right; font-weight: 900; color: var(--accent-green);">₹${u.totalEarned.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Leaderboard error:', err);
  }
}

// Tab Switching
function switchTab(tabId) {
  if (tabId === 'packages' || tabId === 'store') {
    switchTab('overview');
    setTimeout(() => {
      const pkgGrid = document.getElementById('dashboardPackagesGrid');
      if (pkgGrid) pkgGrid.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return;
  }

  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) {
    targetTab.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const navItems = document.querySelectorAll(`[onclick="switchTab('${tabId}')"]`);
  navItems.forEach(item => item.classList.add('active'));

  if (tabId === 'marketing' && currentSelectedTemplate) {
    try { generateMarketingPoster(currentSelectedTemplate); } catch (e) {}
  } else if (tabId === 'idcard') {
    try { renderOfficialIdCard(); } catch (e) {}
    try { renderOfficialPartnerCertificate(); } catch (e) {}
  } else if (tabId === 'overview') {
    try { loadPackages(); } catch (e) {}
  }
}

// Copy Referral Link
function copyReferralLink() {
  const link = document.getElementById('dashboardRefLink').value;
  navigator.clipboard.writeText(link);
  alert('Referral link copied to clipboard!');
}

function shareOnWhatsApp() {
  const link = document.getElementById('dashboardRefLink').value;
  const text = encodeURIComponent(`🔥 Join India's top 60% Commission Affiliate Network!\nPackages from ₹19 to ₹1499.\nRegister with my link:\n${link}`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function scrollToPackages() {
  switchTab('overview');
  document.getElementById('dashboardPackagesGrid').scrollIntoView({ behavior: 'smooth' });
}

// Support Ticket Submission
async function handleSupportTicket(e) {
  e.preventDefault();
  const subject = document.getElementById('ticketSubject').value;
  const message = document.getElementById('ticketMsg').value;
  const token = localStorage.getItem('auth_token');

  try {
    const res = await fetch(`${API_BASE}/support/ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subject, message })
    });
    const data = await res.json();
    alert(data.message);
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMsg').value = '';
  } catch (err) {
    console.error('Ticket error:', err);
    alert('Failed to submit ticket');
  }
}

function handleLogout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
  window.location.href = '/';
}

// --------------------------------------------------------------------------
// OFFICIAL VERIFIED PARTNER CERTIFICATE CANVAS ENGINE
// --------------------------------------------------------------------------
function renderOfficialPartnerCertificate() {
  const canvas = document.getElementById('officialPartnerCertCanvas');
  if (!canvas || !currentUser) return;
  const ctx = canvas.getContext('2d');

  // Background Parchment / Luxury Cream
  ctx.fillStyle = '#fcfbf7';
  ctx.fillRect(0, 0, 800, 560);

  // Ornate Double Gold & Navy Border
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 772, 532);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 748, 508);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.strokeRect(30, 30, 740, 500);

  // Top Header Motif & Emblem
  ctx.textAlign = 'center';
  ctx.font = '28px "Outfit", sans-serif';
  ctx.fillStyle = '#d97706';
  ctx.fillText('🏛️ 🇮🇳 🎖️', 400, 65);

  ctx.font = 'bold 15px "Outfit", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('AFFILIATE EMPIRE BHARAT DIGITAL NETWORK', 400, 92);

  ctx.font = 'bold 11px "Outfit", sans-serif';
  ctx.fillStyle = '#047857';
  ctx.fillText('GOVT MSME REG: UDYAM-DL-08-0048291 • ISO 9001:2015 CERTIFIED', 400, 110);

  // Certificate Title
  ctx.font = '900 24px "Outfit", Georgia, serif';
  ctx.fillStyle = '#b45309';
  ctx.fillText('CERTIFICATE OF AUTHORIZED PARTNERSHIP', 400, 150);

  // Subtitle
  ctx.font = 'italic 14px "Outfit", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('This is to officially certify that our verified partner', 400, 180);

  // User Full Name
  ctx.font = '900 28px "Outfit", serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(currentUser.fullName.toUpperCase(), 400, 220);

  // Underline for Name
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(250, 230);
  ctx.lineTo(550, 230);
  ctx.stroke();

  // Partnership Statement
  ctx.font = '13px "Outfit", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('has been authorized as an Official Affiliate Marketer for digital products & educational courses,', 400, 260);
  ctx.fillText('empowered with 60% Direct Instant Commission distribution rights across India.', 400, 280);

  // Official Details Box in Certificate
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(100, 305, 600, 95);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(100, 305, 600, 95);

  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Outfit", monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText('PERMANENT ID:', 120, 332);
  ctx.fillStyle = '#b45309';
  ctx.font = '900 15px "Outfit", monospace';
  ctx.fillText(currentUser.permanentId, 240, 332);

  ctx.font = 'bold 12px "Outfit", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('ACTIVE TIER:', 120, 360);
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 13px "Outfit", sans-serif';
  ctx.fillText(currentActivePackage ? currentActivePackage.name : 'Starter Pass (₹19 - ₹1499)', 240, 360);

  ctx.fillStyle = '#475569';
  ctx.fillText('DIRECT PAYOUT:', 120, 385);
  ctx.fillStyle = '#b45309';
  ctx.fillText('60% Instant Real Cash Split', 240, 385);

  ctx.fillStyle = '#475569';
  ctx.fillText('ISSUE DATE:', 430, 332);
  ctx.fillStyle = '#0f172a';
  ctx.fillText(new Date(currentUser.createdAt || Date.now()).toLocaleDateString('en-IN'), 520, 332);

  ctx.fillStyle = '#475569';
  ctx.fillText('LEGAL STATUS:', 430, 360);
  ctx.fillStyle = '#047857';
  ctx.fillText('✓ 100% Verified Active', 520, 360);

  ctx.fillStyle = '#475569';
  ctx.fillText('VALIDITY:', 430, 385);
  ctx.fillStyle = '#b45309';
  ctx.fillText('Lifetime Permanent', 520, 385);

  // Seals & Verification Stamps
  // Left: Digital Verification Seal
  ctx.beginPath();
  ctx.arc(170, 470, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#fef3c7';
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 9px "Outfit", sans-serif';
  ctx.fillStyle = '#92400e';
  ctx.fillText('GOVT MSME', 170, 460);
  ctx.fillText('VERIFIED', 170, 473);
  ctx.fillText('★ 2024-2026 ★', 170, 485);

  // Middle: Gold Shield Ribbon
  ctx.font = 'bold 12px "Outfit", sans-serif';
  ctx.fillStyle = '#d97706';
  ctx.fillText('★ OFFICIAL DIGITAL LICENSE ★', 400, 470);
  ctx.font = '10px "Outfit", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Verified by Consumer Protection (Direct Selling) Deed', 400, 488);

  // Right: Authorized Signatory
  ctx.textAlign = 'right';
  ctx.font = 'italic bold 17px "Brush Script MT", cursive, serif';
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText('Vikas Sengupta', 680, 465);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(540, 475);
  ctx.lineTo(680, 475);
  ctx.stroke();

  ctx.font = 'bold 10px "Outfit", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Managing Director & Compliance Officer', 680, 490);
  ctx.font = '9px "Outfit", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('AffiliateEmpire Bharat Authority', 680, 502);
}

// Download Partner Certificate
function downloadOfficialPartnerCertificate() {
  const canvas = document.getElementById('officialPartnerCertCanvas');
  if (!canvas) return;

  const link = document.createElement('a');
  link.download = `AffiliateEmpire_Partner_Certificate_${currentUser ? currentUser.permanentId : 'AP'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
