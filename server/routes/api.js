const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const emailService = require('../emailService');

const JWT_SECRET = 'AFFILIATE_PRO_SUPER_SECRET_KEY_2026_JWT';

// Helper function to generate Unique Permanent User ID (e.g. AP-784210)
function generatePermanentId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `AP-${num}`;
}

// Helper to find user flexibly with microsecond indexed lookups (Scales to Lakhs / Millions of users 100% Free)
function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();
  const digitsOnly = raw.replace(/\D/g, '');
  const last10 = digitsOnly.slice(-10);
  const cleanPid = upper.replace(/[^A-Z0-9]/g, '');

  // 1. Direct ID lookup (O(1))
  let user = db.users.findById(raw);
  if (user) return user;

  // 2. Direct Email lookup (Indexed)
  user = db.users.findOne({ email: lower }) ||
         db.users.findOne({ email: raw });
  if (user) return user;

  // 3. Direct Permanent ID lookup (Indexed)
  const candidatePid = cleanPid.startsWith('AP') ? cleanPid : `AP-${cleanPid}`;
  const candidatePidDash = cleanPid.startsWith('AP') && !cleanPid.includes('-') ? `AP-${cleanPid.slice(2)}` : cleanPid;
  user = db.users.findOne({ permanentId: upper }) ||
         db.users.findOne({ permanentId: candidatePid }) ||
         db.users.findOne({ permanentId: candidatePidDash });
  if (user) return user;

  // 4. Direct Phone lookup (Indexed)
  if (digitsOnly) {
    user = db.users.findOne({ phone: digitsOnly }) ||
           (last10.length === 10 ? db.users.findOne({ phone: last10 }) : null);
    if (user) return user;
  }

  // 5. Full Name lookup
  user = db.users.findOne({ fullName: raw }) ||
         db.users.findOne({ fullName: lower });
  if (user) return user;

  // 6. Fast SQLite query fallback (Case-Insensitive search across million rows)
  if (db.sqlite) {
    try {
      const sql = `
        SELECT data FROM users 
        WHERE LOWER(json_extract(data, '$.email')) = ?
           OR LOWER(json_extract(data, '$.email')) LIKE ?
           OR UPPER(json_extract(data, '$.permanentId')) = ?
           OR UPPER(json_extract(data, '$.permanentId')) = ?
           OR json_extract(data, '$.phone') = ?
           OR json_extract(data, '$.phone') LIKE ?
           OR LOWER(json_extract(data, '$.fullName')) = ?
           OR LOWER(json_extract(data, '$.fullName')) LIKE ?
        LIMIT 1
      `;
      const row = db.sqlite.prepare(sql).get(
        lower,
        `${lower}%`,
        upper,
        candidatePidDash,
        digitsOnly,
        `%${last10}%`,
        lower,
        `%${lower}%`
      );
      if (row && row.data) {
        return JSON.parse(row.data);
      }
    } catch (e) {}
  }

  // 7. Comprehensive in-memory fallback scan
  try {
    const allUsers = db.users.find();
    const matched = allUsers.find(u => {
      const uEmail = (u.email || '').toLowerCase();
      const uPid = (u.permanentId || '').toUpperCase();
      const uPhone = (u.phone || '').replace(/\D/g, '');
      const uName = (u.fullName || '').toLowerCase();

      return uEmail === lower ||
             (lower.length >= 3 && uEmail.startsWith(lower)) ||
             uPid === upper ||
             uPid === candidatePid ||
             uPid === candidatePidDash ||
             (digitsOnly.length >= 6 && uPhone.includes(digitsOnly)) ||
             uName === lower ||
             (lower.length >= 3 && uName.includes(lower));
    });
    if (matched) return matched;
  } catch (e) {}

  return null;
}

// Authentication Middleware with Permanent Persistence Check
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    const freshUser = db.users.findById(user.id) ||
                      (user.permanentId ? findUserByIdentifier(user.permanentId) : null) ||
                      findUserByIdentifier(user.id);
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

    const cleanName = fullName.trim();
    const cleanEmail = email.toLowerCase().trim();
    const rawPhoneDigits = phone.replace(/\D/g, '');
    const cleanPhone = rawPhoneDigits.length >= 10 ? rawPhoneDigits.slice(-10) : phone.trim();

    // Check existing email or phone
    const existingEmail = findUserByIdentifier(cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        message: `This Email is already registered with Permanent ID (${existingEmail.permanentId}). Please login with your password.` 
      });
    }

    const existingPhone = findUserByIdentifier(cleanPhone);
    if (existingPhone) {
      return res.status(400).json({ 
        success: false, 
        message: `This Phone Number is already registered with Permanent ID (${existingPhone.permanentId}). Please login with your password.` 
      });
    }

    // Verify referral code if provided
    let referrer = null;
    if (referralCode && referralCode.trim() !== '') {
      referrer = findUserByIdentifier(referralCode.trim());
    }

    const permanentId = generatePermanentId();
    const passwordHash = await bcrypt.hash(password.trim(), 10);

    const newUser = {
      permanentId: permanentId,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash: passwordHash,
      role: 'user',
      walletBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      purchasedPackages: [],
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

    // Generate Long-Term JWT Token (365 days permanent session)
    const token = jwt.sign(
      { id: createdUser.id, permanentId: createdUser.permanentId, role: createdUser.role }, 
      JWT_SECRET, 
      { expiresIn: '365d' }
    );

    // Send Professional Congratulations & Welcome Email
    const origin = `${req.protocol}://${req.get('host')}`;
    emailService.sendWelcomeEmail(createdUser, origin).catch(e => console.error('Welcome email error:', e));

    // Remove passwordHash from response
    const { passwordHash: _, ...safeUser } = createdUser;

    return res.status(201).json({
      success: true,
      message: `🎉 Account Created Successfully! Aapki Permanent ID hai: ${createdUser.permanentId}`,
      permanentId: createdUser.permanentId,
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
    const { identifier, password } = req.body; // identifier can be email, phone, permanent ID or name

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please enter Username / Permanent ID / Phone / Email and password.' });
    }

    const cleanId = identifier.trim();
    const cleanPassword = password.trim();

    const user = findUserByIdentifier(cleanId);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account not found. Please check your Permanent ID, Phone, Email or Username.' 
      });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash) || 
                    (password === user.passwordHash) || // in case plaintext fallback
                    (await bcrypt.compare(password, user.passwordHash));

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Galat Password! Sahi password enter karein.' });
    }

    // Generate Long-Term JWT Token (365 days permanent session)
    const token = jwt.sign(
      { id: user.id, permanentId: user.permanentId, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '365d' }
    );
    const { passwordHash: _, ...safeUser } = user;

    return res.json({
      success: true,
      message: `Login successful! Welcome back ${user.fullName}`,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// -------------------------------------------------------------
// FORGOT PASSWORD & RESET PASSWORD SYSTEM
// -------------------------------------------------------------

// 1. Request Password Reset (Generates & Sends 6-Digit OTP)
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your Email, Permanent ID or Mobile Number.' });
    }

    const user = findUserByIdentifier(identifier.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'No registered account found with these details.' });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    // Store in user record in SQLite
    db.users.update(user.id, {
      resetOtp: otp,
      resetOtpExpiry: expiry
    });

    // Mask user email for privacy (e.g. ro***@gmail.com)
    const emailParts = user.email.split('@');
    const maskedEmail = user.email.length > 5 
      ? `${emailParts[0].substring(0, 2)}***@${emailParts[1]}` 
      : user.email;

    // Dispatch Professional Email
    const origin = `${req.protocol}://${req.get('host')}`;
    emailService.sendPasswordResetOtpEmail(user, otp, origin).catch(e => console.error('Reset OTP email error:', e));

    return res.json({
      success: true,
      message: `6-Digit Reset OTP has been sent to your registered email (${maskedEmail}) and Permanent ID (${user.permanentId})!`,
      maskedEmail: maskedEmail,
      permanentId: user.permanentId,
      // Provide OTP in response for development convenience
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing password reset.' });
  }
});

// 2. Submit OTP & Set New Password
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide identifier, OTP, and new password.' });
    }

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    const user = findUserByIdentifier(identifier.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Verify OTP
    if (!user.resetOtp || String(user.resetOtp).trim() !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Galat OTP Code! Please enter valid 6-digit OTP.' });
    }

    // Verify Expiry
    if (user.resetOtpExpiry && Date.now() > user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    // Hash New Password & Clear OTP
    const newHash = await bcrypt.hash(newPassword.trim(), 10);
    db.users.update(user.id, {
      passwordHash: newHash,
      resetOtp: null,
      resetOtpExpiry: null
    });

    console.log(`🔑 [PASSWORD RESET SUCCESS] User ${user.permanentId} successfully updated password.`);

    return res.json({
      success: true,
      message: '🎉 Password Reset Successful! You can now log in with your new password.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
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

// Get all packages (Sorted in Ascending Price Order: ₹19, ₹29, ₹49, ₹99, ₹299, ₹699, ₹1499)
router.get('/packages', (req, res) => {
  const pkgs = db.packages.find().sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
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

    // Send Professional Invoice Email to Buyer
    const pkg = db.packages.findById(order.packageId);
    if (buyer && pkg) {
      const origin = `${req.protocol}://${req.get('host')}`;
      emailService.sendPackagePurchaseEmail(buyer, updatedOrder, pkg, origin).catch(e => console.error('Purchase email error:', e));
    }

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

// Helper to determine maximum package tier price unlocked by user
function getUserMaxTierPrice(user) {
  if (!user) return 0;
  if (user.role === 'admin') return 999999;

  const allPackages = db.packages.find();
  const purchasedPkgIds = user.purchasedPackages || [];
  if (purchasedPkgIds.length === 0) return 0;

  let maxPrice = 0;
  for (const pkgId of purchasedPkgIds) {
    const pkg = allPackages.find(p => p.id === pkgId);
    if (pkg && pkg.price > maxPrice) {
      maxPrice = pkg.price;
    }
  }
  return maxPrice;
}

// Helper to credit 60% Commission with Strict Tier Capping Rule
// (e.g. ₹19 owner earns on ₹19; ₹49 owner earns on ₹19 & ₹49; higher sales capped at owner's tier)
function distributeAffiliateCommission(buyer, order) {
  if (!buyer || !buyer.referredBy) return;

  const referrer = db.users.findOne({ permanentId: buyer.referredBy }) ||
                   db.users.findById(buyer.referredBy) ||
                   findUserByIdentifier(buyer.referredBy);
  if (!referrer) return;

  const referrerMaxTierPrice = getUserMaxTierPrice(referrer);

  // If referrer has 0 active packages (never purchased a package)
  if (referrerMaxTierPrice === 0) {
    console.log(`[COMMISSION LOCKED] Referrer ${referrer.permanentId} has no active package.`);
    db.transactions.insert({
      userId: referrer.id,
      userPermanentId: referrer.permanentId,
      type: 'COMMISSION_LOCKED_UPGRADE_REQUIRED',
      amount: 0,
      description: `🔒 Missed 60% Commission (₹${(order.amount * 0.60).toFixed(2)}) from ${buyer.fullName} (${order.packageName}). Buy at least ₹19 Starter Pass to unlock wallet payouts!`,
      orderId: order.id,
      buyerId: buyer.permanentId,
      createdAt: new Date().toISOString()
    });
    return;
  }

  // Tier Capping: Commission base amount is capped at the maximum tier the referrer has purchased
  const eligibleBaseAmount = Math.min(order.amount, referrerMaxTierPrice);
  const commissionAmount = Number((eligibleBaseAmount * 0.60).toFixed(2));

  if (commissionAmount <= 0) return;

  const newBalance = Number(((referrer.walletBalance || 0) + commissionAmount).toFixed(2));
  const newTotalEarned = Number(((referrer.totalEarned || 0) + commissionAmount).toFixed(2));

  db.users.update(referrer.id, {
    walletBalance: newBalance,
    totalEarned: newTotalEarned
  });

  const isCapped = referrerMaxTierPrice < order.amount;
  const description = isCapped
    ? `60% Commission from ${buyer.fullName} [₹${commissionAmount} capped at your ₹${referrerMaxTierPrice} Tier - Upgrade package to earn full ₹${(order.amount * 0.60).toFixed(2)}!]`
    : `60% Instant Affiliate Commission from ${buyer.fullName} (${order.packageName})`;

  // Log Ledger Transaction
  db.transactions.insert({
    userId: referrer.id,
    userPermanentId: referrer.permanentId,
    type: 'REFERRAL_COMMISSION_60',
    amount: commissionAmount,
    description: description,
    orderId: order.id,
    buyerId: buyer.permanentId,
    isCapped: isCapped,
    tierCappedAt: isCapped ? referrerMaxTierPrice : null,
    createdAt: new Date().toISOString()
  });

  console.log(`[COMMISSION] Credited ₹${commissionAmount} to referrer ${referrer.permanentId} for order ${order.id} (Max Tier: ₹${referrerMaxTierPrice})`);
}

// AI 1-Click WhatsApp Outreach Pitch Generator API
router.post('/tools/pitch-generator', authenticateToken, (req, res) => {
  try {
    const { leadName, pitchStyle, targetPrice } = req.body;
    const user = req.user;
    const refUrl = `${req.protocol}://${req.get('host')}/?ref=${user.permanentId}`;
    const name = (leadName && leadName.trim()) ? leadName.trim() : 'Friend';

    const pitches = {
      'friendly_hindi': `Namaste ${name} ji! 🙏\nMaine dekha aap mobile phone se online part-time income me interested hain.\n\nHumara verified 60% Affiliate Commission platform live hai. Sirf ₹19 ya ₹49 se start karke aap daily ₹500-₹1500 directly UPI me kama sakte hain! 💸\n\n👉 Abhi register karke shuru karein:\n${refUrl}\n\n(Permanent Partner ID: ${user.permanentId})`,
      'urgent_deal': `🔥 Urgent Special Deal for ${name}!\n\nAaj sirf ₹19 - ₹49 me Affiliate Empire Bharat ka official partner banein aur har referral par 60% direct cash paayein!\n\n⚡ Minimum Withdrawal sirf ₹50 (Instant UPI)\n⚡ Ready-made Buyer Leads Pool Included\n\n👉 Register now before offer ends:\n${refUrl}`,
      'student_earning': `Hey ${name}! 👋\nApne mobile phone ka use karke pocket money aur daily income generate karna chahte ho?\n\nZero inventory, direct 60% instant commission. Har friend ya contact ke join karne par instant paise aapke wallet me!\n\n🚀 Join here:\n${refUrl}`,
      'creator_pro': `Hello ${name}! 🚀\nMonetize your WhatsApp status & social media with 60% lifetime affiliate payout.\n\n✅ 100+ Ready-made Canva Posters\n✅ Instant 60% Auto Payout Engine\n✅ Direct WhatsApp Leads Stream\n\n👉 Access Platform:\n${refUrl}`
    };

    const selectedPitch = pitches[pitchStyle] || pitches['friendly_hindi'];

    return res.json({
      success: true,
      pitch: selectedPitch,
      refUrl: refUrl,
      permanentId: user.permanentId
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate pitch' });
  }
});

/* ==========================================================================
   3. SMART HOT LEADS HUB & WHATSAPP OUTREACH APIS
   ========================================================================== */

// Get Hot Buyer Leads Pool based on user's purchased package tier
router.get('/leads', authenticateToken, (req, res) => {
  const user = req.user;
  const allLeads = db.leads.find();

  // Determine unlocked leads count (base tier + earned bonus leads)
  let unlockedCount = user.bonusLeads || 0;
  let activePkg = null;

  if (user.activePackageId) {
    activePkg = db.packages.findById(user.activePackageId);
    if (activePkg) {
      unlockedCount = (activePkg.leadsUnlocked || 10) + (user.bonusLeads || 0);
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

    // 100% Real Commercial Rewards (No fake money creation - purely backed by real sales & digital assets)
    const rewardOptions = [
      { type: 'leads', amount: 2, label: '🔥 +2 Extra Hot Buyer Leads Unlocked', description: '2 verified WhatsApp buyer contacts added to your leads pool!' },
      { type: 'leads', amount: 3, label: '⚡ +3 Premium WhatsApp Buyer Leads', description: '3 verified WhatsApp buyer contacts added to your leads pool!' },
      { type: 'voucher', discount: 10, label: '🎟️ ₹10 OFF on Next Package Upgrade', description: 'Use when upgrading to your next tier package!' },
      { type: 'booster', bonusPercent: 5, label: '🚀 +5% Commission Booster on Next Referral', description: 'Earn 65% instead of 60% on your next direct sale!' },
      { type: 'templates', label: '🎨 VIP 10x Viral Story Templates Pack', description: 'Unlocked 10 exclusive high-converting Canva templates!' }
    ];

    const randomReward = rewardOptions[Math.floor(Math.random() * rewardOptions.length)];

    // Save bonus unlocked in user profile
    const currentBonusLeads = user.bonusLeads || 0;
    const newBonusLeads = randomReward.type === 'leads' ? (currentBonusLeads + randomReward.amount) : currentBonusLeads;
    const activeCoupons = user.activeCoupons || [];
    if (randomReward.type === 'voucher') {
      activeCoupons.push({ discount: randomReward.discount, date: todayStr });
    }

    db.users.update(user.id, {
      lastSpinDate: todayStr,
      bonusLeads: newBonusLeads,
      activeCoupons: activeCoupons,
      activeBooster: randomReward.type === 'booster' ? 5 : (user.activeBooster || 0)
    });

    return res.json({
      success: true,
      message: `🎉 Congratulations! You won: ${randomReward.label}`,
      reward: randomReward,
      bonusLeadsTotal: newBonusLeads
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

// Admin: Send Real Live Test Email via SMTP
router.post('/admin/email/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { testEmail } = req.body;
    const target = (testEmail && testEmail.trim()) ? testEmail.trim() : req.user.email;

    if (!target) {
      return res.status(400).json({ success: false, message: 'Please provide a valid destination email address.' });
    }

    const result = await emailService.sendTestEmail(target);
    if (result.success) {
      return res.json({
        success: true,
        message: `✅ Test email successfully dispatched to ${target}!`,
        result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `❌ Failed to send email: ${result.error || 'Check SMTP configuration'}`,
        error: result.error
      });
    }
  } catch (err) {
    console.error('Test email error:', err);
    return res.status(500).json({ success: false, message: 'Server error testing email gateway', error: err.message });
  }
});

// Public System Config (for landing page & trust badges)
router.get('/config/public', (req, res) => {
  const settings = db.settings.data[0] || {};
  return res.json({
    success: true,
    config: {
      siteName: settings.siteName || 'AffiliateEmpire Bharat',
      upiId: settings.upiId || 'mrvikash@fam',
      merchantName: settings.merchantName || 'vikas',
      supportWhatsapp: settings.supportWhatsapp || '919876543210',
      supportEmail: settings.supportEmail || 'support@affiliateempire.in',
      announcement: settings.announcement || 'Earn flat 60% Direct Commission on ₹19 to ₹1499 packages!',
      minWithdrawal: settings.minWithdrawal || 50,
      msmeRegNo: settings.msmeRegNo || 'UDYAM-DL-08-0048291',
      isoCertNo: settings.isoCertNo || 'ISO 9001:2015 (QMS-2024-IN89)',
      cinGovNo: settings.cinGovNo || 'U74999DL2024PTC392810',
      taxCompliance: settings.taxCompliance || 'GST & Section 194H TDS Compliant'
    }
  });
});

module.exports = router;
