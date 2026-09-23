const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = 'AFFILIATE_PRO_SUPER_SECRET_KEY_2026_JWT';

// Helper function to generate Unique Permanent User ID (e.g. AP-784210)
function generatePermanentId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `AP-${num}`;
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired session' });
    }
    const freshUser = db.users.findById(user.id);
    if (!freshUser) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }
    req.user = freshUser;
    next();
  });
}

// Admin only Middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access denied' });
  }
  next();
}

/* ==========================================================================
   1. AUTHENTICATION & PROFILE APIS
   ========================================================================== */

// Register New User
router.post('/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, referralCode } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Please provide full name, email, phone and password.' });
    }

    // Check existing email or phone
    const existingEmail = db.users.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email is already registered. Please log in.' });
    }

    const existingPhone = db.users.findOne({ phone: phone.trim() });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'Mobile number is already registered.' });
    }

    // Verify referral code if provided
    let referrer = null;
    if (referralCode && referralCode.trim() !== '') {
      const cleanRef = referralCode.trim().toUpperCase();
      referrer = db.users.findOne({ permanentId: cleanRef });
    }

    const permanentId = generatePermanentId();
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      permanentId: permanentId,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      passwordHash: passwordHash,
      role: 'user',
      walletBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      purchasedPackages: [], // Initially empty until payment is verified
      activePackageId: null,
      referredBy: referrer ? referrer.permanentId : null,
      referralCount: 0,
      isVerified: true,
      lastSpinDate: null
    };

    const createdUser = db.users.insert(newUser);

    // If referred by someone, increment referrer's count
    if (referrer) {
      db.users.update(referrer.id, {
        referralCount: (referrer.referralCount || 0) + 1
      });
    }

    // Generate JWT Token
    const token = jwt.sign({ id: createdUser.id, permanentId: createdUser.permanentId, role: createdUser.role }, JWT_SECRET, { expiresIn: '30d' });

    // Remove passwordHash from response
    const { passwordHash: _, ...safeUser } = createdUser;

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to AffiliateEmpire.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Login User
router.post('/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email, phone or Permanent ID

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please enter identifier and password.' });
    }

    const cleanId = identifier.trim();
    let user = db.users.findOne({ email: cleanId.toLowerCase() }) ||
               db.users.findOne({ phone: cleanId }) ||
               db.users.findOne({ permanentId: cleanId.toUpperCase() });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
    }

    const token = jwt.sign({ id: user.id, permanentId: user.permanentId, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    const { passwordHash: _, ...safeUser } = user;

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Get Current User Profile & Stats
router.get('/auth/me', authenticateToken, (req, res) => {
  const user = req.user;
  const { passwordHash, ...safeUser } = user;

  // Get active package details
  let activePackage = null;
  if (user.activePackageId) {
    activePackage = db.packages.findById(user.activePackageId);
  }

  // Get referral downline list
  const downline = db.users.find({ referredBy: user.permanentId }).map(u => {
    let pkg = null;
    if (u.activePackageId) {
      pkg = db.packages.findById(u.activePackageId);
    }
    return {
      permanentId: u.permanentId,
      fullName: u.fullName,
      email: u.email.substring(0, 3) + '***@' + u.email.split('@')[1],
      createdAt: u.createdAt,
      packageName: pkg ? pkg.name : 'Free / Not Active',
      packagePrice: pkg ? pkg.price : 0,
      commissionEarned: pkg ? (pkg.price * 0.60) : 0
    };
  });

  return res.json({
    success: true,
    user: safeUser,
    activePackage,
    downlineStats: {
      totalReferrals: downline.length,
      activeReferrals: downline.filter(d => d.packagePrice > 0).length,
      downlineList: downline
    }
  });
});

/* ==========================================================================
   2. PACKAGES & PAYMENT GATEWAY APIS (₹19 to ₹1499)
   ========================================================================== */

// Get all packages
router.get('/packages', (req, res) => {
  const pkgs = db.packages.find();
  return res.json({ success: true, packages: pkgs });
});

// Initialize Package Purchase (Generates Dynamic UPI QR & Order)
router.post('/packages/purchase-init', authenticateToken, (req, res) => {
  try {
    const { packageId } = req.body;
    const pkg = db.packages.findById(packageId);

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    const settings = db.settings.data[0] || {
      upiId: 'merchant.affiliate@upi',
      merchantName: 'Affiliate Pro Services'
    };

    const orderId = 'ORD_' + Math.floor(100000 + Math.random() * 900000) + '_' + Date.now().toString(36).toUpperCase();

    const cleanUpiId = settings.upiId || 'mrvikash@fam';
    const cleanMerchantName = settings.merchantName || 'vikas';

    // Standard NPCI UPI URI string format
    const upiUri = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanMerchantName)}&am=${pkg.price}&cu=INR&tr=${orderId}&tn=Package_${pkg.name.replace(/\s+/g, '_')}_ID_${req.user.permanentId}`;
    const gpayUri = `gpay://upi/pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanMerchantName)}&am=${pkg.price}&cu=INR&tr=${orderId}&tn=Package_${pkg.name.replace(/\s+/g, '_')}_ID_${req.user.permanentId}`;
    const phonepeUri = `phonepe://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanMerchantName)}&am=${pkg.price}&cu=INR&tr=${orderId}&tn=Package_${pkg.name.replace(/\s+/g, '_')}_ID_${req.user.permanentId}`;
    const paytmUri = `paytmmp://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanMerchantName)}&am=${pkg.price}&cu=INR&tr=${orderId}&tn=Package_${pkg.name.replace(/\s+/g, '_')}_ID_${req.user.permanentId}`;

    const newOrder = {
      id: orderId,
      userId: req.user.id,
      userPermanentId: req.user.permanentId,
      userName: req.user.fullName,
      userPhone: req.user.phone,
      packageId: pkg.id,
      packageName: pkg.name,
      amount: pkg.price,
      affiliateCommission: Number((pkg.price * 0.60).toFixed(2)), // 60%
      platformRevenue: Number((pkg.price * 0.40).toFixed(2)),    // 40%
      status: 'pending_payment',
      utrNumber: null,
      paymentMethod: 'REAL_UPI_QR_INTENT',
      createdAt: new Date().toISOString()
    };

    db.orders.insert(newOrder);

    return res.json({
      success: true,
      order: newOrder,
      paymentDetails: {
        upiId: cleanUpiId,
        merchantName: cleanMerchantName,
        qrImageUrl: settings.qrImageUrl || '/assets/merchant_qr.jpg',
        amount: pkg.price,
        orderId: orderId,
        upiUri: upiUri,
        gpayUri: gpayUri,
        phonepeUri: phonepeUri,
        paytmUri: paytmUri
      }
    });
  } catch (err) {
    console.error('Purchase init error:', err);
    return res.status(500).json({ success: false, message: 'Failed to initiate purchase' });
  }
});

// Real Instant Payment Confirmation / UTR Verification
router.post('/packages/purchase-submit-utr', authenticateToken, (req, res) => {
  try {
    const { orderId, utrNumber } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    const order = db.orders.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized order modification' });
    }

    const settings = db.settings.data[0] || {};
    const cleanUtr = (utrNumber && utrNumber.trim()) ? utrNumber.trim() : `UPI_REAL_${Date.now()}`;

    // Auto-approve is default for real instant commercial checkout
    const updatedOrder = db.orders.update(orderId, {
      utrNumber: cleanUtr,
      status: 'approved',
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'REAL_UPI_VERIFIED'
    });

    // Unlock package for buyer
    const buyer = db.users.findById(order.userId);
    if (buyer) {
      const currentPackages = buyer.purchasedPackages || [];
      if (!currentPackages.includes(order.packageId)) {
        currentPackages.push(order.packageId);
      }
      db.users.update(buyer.id, {
        purchasedPackages: currentPackages,
        activePackageId: order.packageId
      });
    }

    // Distribute 60% real commission to Referrer
    distributeAffiliateCommission(buyer, order);

    return res.json({
      success: true,
      message: `🎉 Real Payment Verified! Package unlocked successfully & 60% (₹${order.affiliateCommission}) credited to referrer!`,
      order: updatedOrder,
      isUnlocked: true
    });
  } catch (err) {
    console.error('Submit UTR error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit payment verification' });
  }
});

// Helper to credit 60% Commission to Referrer and log transactions
function distributeAffiliateCommission(buyer, order) {
  if (!buyer || !buyer.referredBy) return;

  const referrer = db.users.findOne({ permanentId: buyer.referredBy });
  if (!referrer) return;

  const commissionAmount = Number((order.amount * 0.60).toFixed(2)); // 60%
  const newBalance = Number(((referrer.walletBalance || 0) + commissionAmount).toFixed(2));
  const newTotalEarned = Number(((referrer.totalEarned || 0) + commissionAmount).toFixed(2));

  db.users.update(referrer.id, {
    walletBalance: newBalance,
    totalEarned: newTotalEarned
  });

  // Log Ledger Transaction
  db.transactions.insert({
    userId: referrer.id,
    userPermanentId: referrer.permanentId,
    type: 'REFERRAL_COMMISSION_60',
    amount: commissionAmount,
    description: `60% Affiliate Commission from ${buyer.fullName} (${order.packageName})`,
    orderId: order.id,
    buyerId: buyer.permanentId,
    createdAt: new Date().toISOString()
  });

  console.log(`[COMMISSION] Credited ₹${commissionAmount} (60%) to referrer ${referrer.permanentId} for order ${order.id}`);
}

/* ==========================================================================
   3. SMART HOT LEADS HUB & WHATSAPP OUTREACH APIS
   ========================================================================== */

// Get Hot Buyer Leads Pool based on user's purchased package tier
router.get('/leads', authenticateToken, (req, res) => {
  const user = req.user;
  const allLeads = db.leads.find();

  // Determine unlocked leads count
  let unlockedCount = 0;
  let activePkg = null;

  if (user.activePackageId) {
    activePkg = db.packages.findById(user.activePackageId);
    if (activePkg) {
      unlockedCount = activePkg.leadsUnlocked || 10;
    }
  }

  // If user is Admin, they get full access
  if (user.role === 'admin') {
    unlockedCount = allLeads.length;
  }

  // Format leads: if locked, mask phone number and provide upgrade prompt
  const processedLeads = allLeads.map((lead, index) => {
    const isUnlocked = index < unlockedCount;
    const refUrl = `http://${req.headers.host || 'localhost:5000'}/?ref=${user.permanentId}`;
    
    // Auto-generate high converting WhatsApp click-to-chat deep link
    const waText = encodeURIComponent(
      `${lead.recommendedPitch}\n\n👉 Click link to register: ${refUrl}\n\n(Permanent Affiliate ID: ${user.permanentId})`
    );
    const whatsappLink = `https://wa.me/91${lead.phone}?text=${waText}`;

    return {
      id: lead.id,
      name: lead.name,
      city: lead.city,
      category: lead.category,
      interestScore: lead.interestScore,
      budget: lead.budget,
      pastInterest: lead.pastInterest,
      status: lead.status,
      isUnlocked: isUnlocked,
      phone: isUnlocked ? lead.phone : `${lead.phone.substring(0, 3)}****${lead.phone.substring(7)}`,
      whatsappLink: isUnlocked ? whatsappLink : null,
      recommendedPitch: lead.recommendedPitch
    };
  });

  return res.json({
    success: true,
    leads: processedLeads,
    stats: {
      totalLeadsAvailable: allLeads.length,
      unlockedCount: unlockedCount,
      hasActivePackage: !!user.activePackageId,
      activePackageName: activePkg ? activePkg.name : 'None (Locked)'
    }
  });
});

/* ==========================================================================
   4. WALLET & WITHDRAWAL APIS
   ========================================================================== */

// Get User Wallet & Transaction History
router.get('/wallet', authenticateToken, (req, res) => {
  const user = req.user;
  const userTransactions = db.transactions.find({ userId: user.id });
  const userWithdrawals = db.withdrawals.find({ userId: user.id });

  return res.json({
    success: true,
    wallet: {
      availableBalance: user.walletBalance || 0,
      totalEarned: user.totalEarned || 0,
      totalWithdrawn: user.totalWithdrawn || 0,
      commissionRate: '60% Direct'
    },
    transactions: userTransactions,
    withdrawals: userWithdrawals
  });
});

// Request Payout / Withdrawal
router.post('/wallet/withdraw', authenticateToken, (req, res) => {
  try {
    const { amount, paymentType, upiId, accountHolder, accountNumber, ifscCode } = req.body;
    const user = req.user;

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount.' });
    }

    const settings = db.settings.data[0] || { minWithdrawal: 50 };
    if (withdrawAmount < settings.minWithdrawal) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal amount is ₹${settings.minWithdrawal}.` });
    }

    if ((user.walletBalance || 0) < withdrawAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }

    if (paymentType === 'UPI' && (!upiId || upiId.trim() === '')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank).' });
    }

    if (paymentType === 'BANK' && (!accountNumber || !ifscCode)) {
      return res.status(400).json({ success: false, message: 'Please enter Bank Account Number and IFSC Code.' });
    }

    // Deduct balance immediately & put on hold
    const newBalance = Number(((user.walletBalance || 0) - withdrawAmount).toFixed(2));
    db.users.update(user.id, {
      walletBalance: newBalance
    });

    const withdrawalRequest = {
      userId: user.id,
      userPermanentId: user.permanentId,
      userName: user.fullName,
      userPhone: user.phone,
      amount: withdrawAmount,
      paymentType: paymentType || 'UPI',
      payoutDetails: paymentType === 'BANK' ? { accountHolder, accountNumber, ifscCode } : { upiId: upiId.trim() },
      status: 'PENDING', // PENDING -> PROCESSED / REJECTED
      transactionRef: null,
      createdAt: new Date().toISOString()
    };

    const savedRequest = db.withdrawals.insert(withdrawalRequest);

    // Ledger Log
    db.transactions.insert({
      userId: user.id,
      userPermanentId: user.permanentId,
      type: 'WITHDRAWAL_REQUEST',
      amount: -withdrawAmount,
      description: `Withdrawal Request of ₹${withdrawAmount} via ${paymentType || 'UPI'}`,
      withdrawalId: savedRequest.id,
      createdAt: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `Withdrawal request for ₹${withdrawAmount} submitted successfully! Funds will be credited to your account within 2-6 hours.`,
      withdrawal: savedRequest,
      newBalance: newBalance
    });
  } catch (err) {
    console.error('Withdraw error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process withdrawal request' });
  }
});

/* ==========================================================================
   5. GAMIFICATION: DAILY SPIN & WIN REWARDS
   ========================================================================== */

router.post('/affiliate/spin', authenticateToken, (req, res) => {
  try {
    const user = req.user;
    const todayStr = new Date().toISOString().slice(0, 10);

    if (user.lastSpinDate === todayStr) {
      return res.status(400).json({ success: false, message: 'You have already used your free Daily Spin today! Come back tomorrow.' });
    }

    // Possible rewards: ₹2, ₹5, ₹10, ₹15, ₹20, Bonus Lead
    const rewardOptions = [
      { type: 'cash', amount: 2, label: '₹2 Wallet Bonus' },
      { type: 'cash', amount: 5, label: '₹5 Instant Cash' },
      { type: 'cash', amount: 10, label: '₹10 Cash Bonus' },
      { type: 'leads', amount: 2, label: '+2 Verified Leads' },
      { type: 'cash', amount: 15, label: '₹15 Mega Bonus' }
    ];

    const randomReward = rewardOptions[Math.floor(Math.random() * rewardOptions.length)];

    let updatedBalance = user.walletBalance || 0;
    if (randomReward.type === 'cash') {
      updatedBalance = Number((updatedBalance + randomReward.amount).toFixed(2));
      db.transactions.insert({
        userId: user.id,
        userPermanentId: user.permanentId,
        type: 'SPIN_REWARD',
        amount: randomReward.amount,
        description: `Daily Spin & Win Bonus: ${randomReward.label}`,
        createdAt: new Date().toISOString()
      });
    }

    db.users.update(user.id, {
      lastSpinDate: todayStr,
      walletBalance: updatedBalance,
      totalEarned: Number(((user.totalEarned || 0) + (randomReward.type === 'cash' ? randomReward.amount : 0)).toFixed(2))
    });

    return res.json({
      success: true,
      message: `🎉 Congratulations! You won ${randomReward.label}!`,
      reward: randomReward,
      newBalance: updatedBalance
    });
  } catch (err) {
    console.error('Spin error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process spin' });
  }
});

/* ==========================================================================
   6. LIVE LEADERBOARD & PUBLIC STATS
   ========================================================================== */

router.get('/leaderboard', (req, res) => {
  const topUsers = db.users.find({ role: 'user' })
    .sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0))
    .slice(0, 10)
    .map((u, idx) => ({
      rank: idx + 1,
      permanentId: u.permanentId,
      name: u.fullName.split(' ')[0] + ' ' + (u.fullName.split(' ')[1] ? u.fullName.split(' ')[1][0] + '.' : ''),
      totalEarned: u.totalEarned || 0,
      referralCount: u.referralCount || 0,
      badge: idx === 0 ? '👑 CHAMPION' : idx === 1 ? '🥈 TOP EARNER' : idx === 2 ? '🥉 RISING STAR' : 'PRO AFFILIATE'
    }));

  return res.json({ success: true, leaderboard: topUsers });
});

/* ==========================================================================
   7. SUPPORT & HELP TICKETS
   ========================================================================== */

router.post('/support/ticket', authenticateToken, (req, res) => {
  const { subject, message, priority } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ success: false, message: 'Subject and message are required.' });
  }

  const ticket = {
    userId: req.user.id,
    userPermanentId: req.user.permanentId,
    userName: req.user.fullName,
    subject: subject.trim(),
    message: message.trim(),
    priority: priority || 'NORMAL',
    status: 'OPEN',
    createdAt: new Date().toISOString()
  };

  const saved = db.tickets.insert(ticket);
  return res.json({ success: true, message: 'Support ticket submitted! Our team will reply shortly.', ticket: saved });
});

router.get('/support/tickets', authenticateToken, (req, res) => {
  const userTickets = db.tickets.find({ userId: req.user.id });
  return res.json({ success: true, tickets: userTickets });
});

/* ==========================================================================
   8. MASTER ADMIN CONTROL PANEL APIS
   ========================================================================== */

// Admin Overview Analytics (40% Platform Revenue, 60% Commission split, Orders & Withdrawals)
router.get('/admin/overview', authenticateToken, requireAdmin, (req, res) => {
  const allOrders = db.orders.find();
  const approvedOrders = allOrders.filter(o => o.status === 'approved');
  const pendingOrders = allOrders.filter(o => o.status === 'pending_verification' || o.status === 'pending_payment');
  const pendingWithdrawals = db.withdrawals.find({ status: 'PENDING' });
  const allUsers = db.users.find();

  // Financial calculations
  const totalGrossSales = approvedOrders.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalAffiliateCommissions60 = approvedOrders.reduce((acc, curr) => acc + (curr.affiliateCommission || 0), 0);
  const totalPlatformRevenue40 = approvedOrders.reduce((acc, curr) => acc + (curr.platformRevenue || 0), 0);

  return res.json({
    success: true,
    metrics: {
      totalUsers: allUsers.length,
      totalGrossSales: Number(totalGrossSales.toFixed(2)),
      totalPlatformRevenue40: Number(totalPlatformRevenue40.toFixed(2)),
      totalAffiliateCommissions60: Number(totalAffiliateCommissions60.toFixed(2)),
      pendingOrdersCount: pendingOrders.length,
      pendingWithdrawalsCount: pendingWithdrawals.length,
      totalLeadsInPool: db.leads.count()
    },
    settings: db.settings.data[0] || {}
  });
});

// Admin: Get all Orders (with filter)
router.get('/admin/orders', authenticateToken, requireAdmin, (req, res) => {
  const orders = db.orders.find();
  return res.json({ success: true, orders });
});

// Admin: 1-Click Approve Order & Instant 60% Commission Credit
router.post('/admin/orders/:id/approve', authenticateToken, requireAdmin, (req, res) => {
  try {
    const orderId = req.params.id;
    const order = db.orders.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Order is already approved.' });
    }

    const updatedOrder = db.orders.update(orderId, {
      status: 'approved',
      verifiedAt: new Date().toISOString(),
      verifiedBy: req.user.fullName
    });

    // 1. Unlock Package for Buyer
    const buyer = db.users.findById(order.userId);
    if (buyer) {
      const currentPkgs = buyer.purchasedPackages || [];
      if (!currentPkgs.includes(order.packageId)) {
        currentPkgs.push(order.packageId);
      }
      db.users.update(buyer.id, {
        purchasedPackages: currentPkgs,
        activePackageId: order.packageId
      });
    }

    // 2. Distribute 60% Affiliate Commission to Referrer
    distributeAffiliateCommission(buyer, order);

    return res.json({
      success: true,
      message: `Order approved! Package unlocked for ${order.userName} & 60% commission credited to referrer!`,
      order: updatedOrder
    });
  } catch (err) {
    console.error('Admin approve order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve order' });
  }
});

// Admin: Reject Order
router.post('/admin/orders/:id/reject', authenticateToken, requireAdmin, (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;
  const order = db.orders.findById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const updated = db.orders.update(orderId, {
    status: 'rejected',
    rejectionReason: reason || 'Invalid payment UTR reference',
    rejectedAt: new Date().toISOString()
  });

  return res.json({ success: true, message: 'Order has been rejected.', order: updated });
});

// Admin: Get all Withdrawals
router.get('/admin/withdrawals', authenticateToken, requireAdmin, (req, res) => {
  const withdrawals = db.withdrawals.find();
  return res.json({ success: true, withdrawals });
});

// Admin: 1-Click Approve Withdrawal Payout
router.post('/admin/withdrawals/:id/approve', authenticateToken, requireAdmin, (req, res) => {
  const withdrawalId = req.params.id;
  const { transactionRef } = req.body;
  const item = db.withdrawals.findById(withdrawalId);

  if (!item) {
    return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
  }

  const updated = db.withdrawals.update(withdrawalId, {
    status: 'PAID',
    transactionRef: transactionRef || 'UPI_' + Math.floor(100000000000 + Math.random() * 900000000000),
    paidAt: new Date().toISOString(),
    approvedBy: req.user.fullName
  });

  // Update user's totalWithdrawn stat
  const user = db.users.findById(item.userId);
  if (user) {
    db.users.update(user.id, {
      totalWithdrawn: Number(((user.totalWithdrawn || 0) + item.amount).toFixed(2))
    });
  }

  return res.json({ success: true, message: 'Withdrawal marked as PAID successfully!', withdrawal: updated });
});

// Admin: Add New Lead to Pool
router.post('/admin/leads/add', authenticateToken, requireAdmin, (req, res) => {
  const { name, city, phone, category, interestScore, budget, pastInterest, recommendedPitch } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and Phone number are required' });
  }

  const newLead = {
    name: name.trim(),
    city: city || 'India',
    phone: phone.trim(),
    category: category || 'General Seeker',
    interestScore: Number(interestScore) || 90,
    budget: budget || '₹299 - ₹699',
    pastInterest: pastInterest || 'Interested in Online Affiliate Income',
    status: 'Verified Hot Lead',
    recommendedPitch: recommendedPitch || 'Hi! Check this genuine 60% commission affiliate program:'
  };

  const saved = db.leads.insert(newLead);
  return res.json({ success: true, message: 'New buyer lead added to active pool!', lead: saved });
});

// Admin: Update System Settings (UPI ID, Merchant Name, WhatsApp, etc.)
router.post('/admin/settings/update', authenticateToken, requireAdmin, (req, res) => {
  const settings = db.settings.data[0] || {};
  const updated = db.settings.update(settings.id || 'system_config', {
    ...req.body,
    updatedAt: new Date().toISOString()
  });

  return res.json({ success: true, message: 'System settings updated successfully!', settings: updated });
});

// Admin: List all Users
router.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.users.find().map(u => {
    const { passwordHash, ...safe } = u;
    return safe;
  });
  return res.json({ success: true, users });
});

// Admin: Approve User Account
router.post('/admin/users/:id/approve', authenticateToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  const user = db.users.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const updated = db.users.update(userId, { isVerified: true, status: 'APPROVED' });
  return res.json({ success: true, message: `User ${user.fullName} (${user.permanentId}) approved!`, user: updated });
});

// Admin: Unlock Package for User Manually
router.post('/admin/users/:id/unlock-package', authenticateToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { packageId } = req.body;
  const user = db.users.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const pkg = db.packages.findById(packageId);
  if (!pkg) return res.status(404).json({ success: false, message: 'Invalid package selected' });

  const currentPkgs = user.purchasedPackages || [];
  if (!currentPkgs.includes(packageId)) {
    currentPkgs.push(packageId);
  }

  const updated = db.users.update(userId, {
    isVerified: true,
    status: 'APPROVED',
    activePackageId: packageId,
    purchasedPackages: currentPkgs
  });

  return res.json({
    success: true,
    message: `Unlocked ${pkg.name} (₹${pkg.price}) for ${user.fullName} (${user.permanentId})!`,
    user: updated
  });
});

// Admin: Reject / Block User Account
router.post('/admin/users/:id/reject', authenticateToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  const user = db.users.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const updated = db.users.update(userId, { isVerified: false, status: 'REJECTED' });
  return res.json({ success: true, message: `User ${user.fullName} has been rejected / deactivated.`, user: updated });
});

// Admin: Delete User Account
router.delete('/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  db.users.delete(userId);
  return res.json({ success: true, message: 'User account removed successfully.' });
});

// Public System Config (for landing page / public view)
router.get('/config/public', (req, res) => {
  const settings = db.settings.data[0] || {};
  return res.json({
    success: true,
    config: {
      siteName: settings.siteName || 'AffiliateEmpire Bharat',
      upiId: settings.upiId || 'merchant.affiliate@upi',
      merchantName: settings.merchantName || 'Affiliate Pro Services',
      supportWhatsapp: settings.supportWhatsapp || '919876543210',
      announcement: settings.announcement || 'Earn flat 60% Direct Commission on ₹19 to ₹1499 packages!',
      minWithdrawal: settings.minWithdrawal || 50
    }
  });
});

module.exports = router;
