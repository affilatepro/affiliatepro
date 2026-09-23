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

    if (currentActivePackage) {
      document.getElementById('cardActiveTier').innerText = currentActivePackage.name;
      document.getElementById('cardActiveTier').style.color = currentActivePackage.color || '#F59E0B';
      document.getElementById('sidebarPackageName').innerHTML = `Package: <span style="color: ${currentActivePackage.color || '#10B981'}; font-weight: 800;">${currentActivePackage.name}</span>`;
      document.getElementById('lockedAccountBanner').style.display = 'none';
    } else {
      document.getElementById('cardActiveTier').innerText = 'Locked (Free ID)';
      document.getElementById('cardActiveTier').style.color = '#ef4444';
      document.getElementById('sidebarPackageName').innerHTML = `Package: <span style="color: #ef4444; font-weight: 700;">Locked (Free)</span>`;
      document.getElementById('lockedAccountBanner').style.display = 'flex';
    }

    // Downline Team
    if (data.downlineStats) {
      renderDownlineTeam(data.downlineStats);
    }

    // Generate Marketing Poster
    generateMarketingPoster();

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

// Load Packages into Dashboard Store
async function loadPackages() {
  const container = document.getElementById('dashboardPackagesGrid');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/packages`);
    const data = await res.json();
    if (!data.success) return;

    const userPkgs = (currentUser && currentUser.purchasedPackages) || [];

    container.innerHTML = data.packages.map(pkg => {
      const isPurchased = userPkgs.includes(pkg.id);
      return `
        <div class="pkg-card ${isPurchased ? 'featured' : ''}" style="${isPurchased ? 'border-color: #10B981;' : ''}">
          <span class="pkg-badge" style="background: ${isPurchased ? '#10B981' : 'var(--accent-gold-gradient)'}; color: ${isPurchased ? '#fff' : '#000'};">
            ${isPurchased ? 'ACTIVE / UNLOCKED' : pkg.badge}
          </span>
          <div class="pkg-header">
            <h3 class="pkg-title">${pkg.name}</h3>
            <div class="pkg-price-row">
              <span class="pkg-price">₹${pkg.price}</span>
              <span class="pkg-old-price">₹${pkg.originalPrice}</span>
            </div>
            <span class="pkg-commission-pill">⚡ 60% Referral Split: ₹${pkg.affiliatePayout.toFixed(2)}</span>
          </div>
          <p class="pkg-desc">${pkg.description}</p>
          <ul class="pkg-features">
            ${pkg.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
          ${isPurchased ? `
            <button class="btn btn-success" style="width: 100%;" disabled>
              ✓ Unlocked & Active
            </button>
          ` : `
            <button class="btn btn-primary" style="width: 100%;" onclick="initiateBuyPackage('${pkg.id}')">
              ⚡ Unlock for ₹${pkg.price}
            </button>
          `}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading packages:', err);
  }
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

// Render Leads
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
        <a href="${lead.whatsappLink}" target="_blank" class="whatsapp-btn">
          💬 Chat on WhatsApp (Pitch Ready)
        </a>
      ` : `
        <div class="lead-locked-btn" onclick="scrollToPackages()">
          🔒 Locked • Upgrade Package to Unlock WhatsApp Contact
        </div>
      `}
    </div>
  `).join('');
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
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');

  const navItems = document.querySelectorAll(`[onclick="switchTab('${tabId}')"]`);
  navItems.forEach(item => item.classList.add('active'));
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
