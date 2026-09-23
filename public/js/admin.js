const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token');
  const user = JSON.parse(localStorage.getItem('user_info') || '{}');

  if (!token || user.role !== 'admin') {
    alert('Access restricted to Master Administrators only.');
    window.location.href = '/';
    return;
  }

  loadAdminData();
});

// Load All Admin Data
async function loadAdminData() {
  const token = localStorage.getItem('auth_token');
  try {
    // 1. Overview Metrics
    const resOverview = await fetch(`${API_BASE}/admin/overview`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataOverview = await resOverview.json();

    if (dataOverview.success) {
      const m = dataOverview.metrics;
      document.getElementById('metricGrossSales').innerText = `₹${m.totalGrossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      document.getElementById('metricPlatformRevenue').innerText = `₹${m.totalPlatformRevenue40.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      document.getElementById('metricAffiliateCommissions').innerText = `₹${m.totalAffiliateCommissions60.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      document.getElementById('pendingOrdersCountBadge').innerText = m.pendingOrdersCount;
      document.getElementById('pendingPayoutsCountBadge').innerText = m.pendingWithdrawalsCount;

      // Populate Settings form
      const s = dataOverview.settings;
      if (s) {
        document.getElementById('setUpiId').value = s.upiId || '';
        document.getElementById('setMerchantName').value = s.merchantName || '';
        document.getElementById('setSupportWhatsapp').value = s.supportWhatsapp || '';
        document.getElementById('setMinWithdrawal').value = s.minWithdrawal || 50;
        document.getElementById('setAnnouncement').value = s.announcement || '';
        document.getElementById('setAutoApprove').checked = !!s.autoApprovePayments;
      }
    }

    // 2. Load Orders
    loadAdminOrders();

    // 3. Load Withdrawals
    loadAdminWithdrawals();

    // 4. Load Leads
    loadAdminLeads();

    // 5. Load Users
    loadAdminUsers();

  } catch (err) {
    console.error('Admin data error:', err);
  }
}

// Load Orders
async function loadAdminOrders() {
  const token = localStorage.getItem('auth_token');
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    if (data.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-dim);">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.orders.map(o => `
      <tr>
        <td>
          <div style="font-weight: 700; font-family: monospace; color: var(--accent-gold);">${o.id}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${new Date(o.createdAt).toLocaleString()}</div>
        </td>
        <td>
          <div style="font-weight: 700;">${o.userName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${o.userPhone} (${o.userPermanentId})</div>
        </td>
        <td>
          <div style="font-weight: 800;">${o.packageName}</div>
          <div style="font-size: 0.85rem; color: var(--accent-gold);">₹${o.amount}</div>
        </td>
        <td>
          <div style="font-family: monospace; font-weight: 800; color: ${o.utrNumber ? '#10B981' : '#ef4444'};">
            ${o.utrNumber || 'Pending UTR'}
          </div>
        </td>
        <td>
          <div style="color: var(--accent-green); font-weight: 700;">+₹${o.affiliateCommission} (60%)</div>
          <div style="color: var(--text-dim); font-size: 0.75rem;">Admin Net: ₹${o.platformRevenue} (40%)</div>
        </td>
        <td>
          <span class="status-tag ${o.status}">${o.status}</span>
        </td>
        <td>
          ${o.status !== 'approved' ? `
            <div class="action-buttons">
              <button class="btn-approve" onclick="approveOrder('${o.id}')">✓ Approve & Credit 60%</button>
              <button class="btn-reject" onclick="rejectOrder('${o.id}')">✕ Reject</button>
            </div>
          ` : `<span style="color: #10B981; font-size: 0.8rem; font-weight: 700;">✓ Verified</span>`}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Orders error:', err);
  }
}

// 1-Click Approve Order
async function approveOrder(orderId) {
  if (!confirm('Approve this payment? This will unlock the package for the buyer and automatically credit 60% commission to the referrer.')) return;
  const token = localStorage.getItem('auth_token');

  try {
    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    alert(data.message);
    loadAdminData();
  } catch (err) {
    console.error('Approve error:', err);
    alert('Failed to approve order.');
  }
}

// Reject Order
async function rejectOrder(orderId) {
  const reason = prompt('Enter rejection reason (e.g. Invalid UTR / No payment received):');
  if (!reason) return;
  const token = localStorage.getItem('auth_token');

  try {
    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    alert(data.message);
    loadAdminData();
  } catch (err) {
    console.error('Reject error:', err);
  }
}

// Load Withdrawals
async function loadAdminWithdrawals() {
  const token = localStorage.getItem('auth_token');
  const tbody = document.getElementById('adminWithdrawalsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/withdrawals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    if (data.withdrawals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-dim);">No withdrawal requests.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.withdrawals.map(w => {
      const isUpi = w.paymentType === 'UPI';
      const details = isUpi ? `UPI ID: <strong style="color:var(--accent-gold);">${w.payoutDetails?.upiId || 'N/A'}</strong>` :
        `Acc: ${w.payoutDetails?.accountNumber} | IFSC: ${w.payoutDetails?.ifscCode} (${w.payoutDetails?.accountHolder})`;

      return `
        <tr>
          <td>
            <div style="font-family: monospace; font-weight: 700; color: var(--accent-gold);">${w.id}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${new Date(w.createdAt).toLocaleString()}</div>
          </td>
          <td>
            <div style="font-weight: 700;">${w.userName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${w.userPermanentId} (${w.userPhone})</div>
          </td>
          <td style="font-weight: 900; font-size: 1.1rem; color: var(--accent-green);">
            ₹${w.amount}
          </td>
          <td style="font-size: 0.85rem;">
            <div><strong>Mode:</strong> ${w.paymentType}</div>
            <div>${details}</div>
          </td>
          <td>
            <span class="status-tag ${w.status ? w.status.toLowerCase() : 'pending'}">${w.status}</span>
          </td>
          <td>
            ${w.status === 'PENDING' ? `
              <button class="btn-approve" onclick="approveWithdrawal('${w.id}')">✓ Mark as Paid</button>
            ` : `<span style="color: #10B981; font-size: 0.8rem;">Ref: ${w.transactionRef || 'PAID'}</span>`}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Withdrawals error:', err);
  }
}

// 1-Click Approve Withdrawal
async function approveWithdrawal(withdrawalId) {
  const txRef = prompt('Enter Bank/UPI Reference No (or press OK to auto-generate):', `UPI_${Date.now()}`);
  if (txRef === null) return;
  const token = localStorage.getItem('auth_token');

  try {
    const res = await fetch(`${API_BASE}/admin/withdrawals/${withdrawalId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transactionRef: txRef })
    });
    const data = await res.json();
    alert(data.message);
    loadAdminData();
  } catch (err) {
    console.error('Approve withdrawal error:', err);
  }
}

// Load Leads in Admin
async function loadAdminLeads() {
  const token = localStorage.getItem('auth_token');
  const container = document.getElementById('adminLeadsList');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/leads`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    container.innerHTML = data.leads.map(l => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 800; color: #fff;">${l.name} (📍 ${l.city})</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${l.category} • Budget: ${l.budget} • Score: ${l.interestScore}%</div>
          <div style="font-size: 0.8rem; font-family: monospace; color: var(--accent-gold); margin-top: 2px;">+91 ${l.phone}</div>
        </div>
        <a href="${l.whatsappLink}" target="_blank" class="whatsapp-btn" style="padding: 6px 12px; font-size: 0.75rem;">
          💬 Test WA Chat
        </a>
      </div>
    `).join('');
  } catch (err) {
    console.error('Leads error:', err);
  }
}

// Add New Lead
async function handleAdminAddLead(e) {
  e.preventDefault();
  const token = localStorage.getItem('auth_token');
  const payload = {
    name: document.getElementById('newLeadName').value,
    city: document.getElementById('newLeadCity').value,
    phone: document.getElementById('newLeadPhone').value,
    category: document.getElementById('newLeadCategory').value,
    interestScore: document.getElementById('newLeadScore').value,
    budget: document.getElementById('newLeadBudget').value,
    pastInterest: document.getElementById('newLeadHistory').value
  };

  try {
    const res = await fetch(`${API_BASE}/admin/leads/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
      document.getElementById('newLeadName').value = '';
      document.getElementById('newLeadCity').value = '';
      document.getElementById('newLeadPhone').value = '';
      loadAdminLeads();
    }
  } catch (err) {
    console.error('Add lead error:', err);
  }
}

// Load Users
async function loadAdminUsers() {
  const token = localStorage.getItem('auth_token');
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td style="font-family: monospace; font-weight: 800; color: var(--accent-gold);">${u.permanentId}</td>
        <td>
          <div style="font-weight: 700;">${u.fullName}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${u.email} • ${u.phone}</div>
        </td>
        <td>
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.08);">
            ${u.activePackageId || 'Free / Locked'}
          </span>
        </td>
        <td style="font-weight: 800; color: var(--accent-gold);">₹${(u.walletBalance || 0).toFixed(2)}</td>
        <td style="font-weight: 800; color: var(--accent-green);">₹${(u.totalEarned || 0).toFixed(2)}</td>
        <td>${u.referralCount || 0}</td>
        <td style="font-family: monospace; color: var(--text-dim);">${u.referredBy || 'Direct'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Users error:', err);
  }
}

// Save Settings
async function handleAdminSaveSettings(e) {
  e.preventDefault();
  const token = localStorage.getItem('auth_token');
  const payload = {
    upiId: document.getElementById('setUpiId').value,
    merchantName: document.getElementById('setMerchantName').value,
    supportWhatsapp: document.getElementById('setSupportWhatsapp').value,
    minWithdrawal: Number(document.getElementById('setMinWithdrawal').value),
    announcement: document.getElementById('setAnnouncement').value,
    autoApprovePayments: document.getElementById('setAutoApprove').checked
  };

  try {
    const res = await fetch(`${API_BASE}/admin/settings/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    alert(data.message);
  } catch (err) {
    console.error('Settings error:', err);
  }
}

// Switch Tabs
function switchAdminTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(`admin-tab-${tabId}`);
  if (target) target.classList.add('active');

  const navItems = document.querySelectorAll(`[onclick="switchAdminTab('${tabId}')"]`);
  navItems.forEach(i => i.classList.add('active'));
}

function handleAdminLogout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
  window.location.href = '/';
}
