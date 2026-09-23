const db = require('./db');
const bcrypt = require('bcryptjs');

async function seedInitialData() {
  // 1. Setup Packages (₹19 to ₹1499)
  if (db.packages.count() === 0) {
    const defaultPackages = [
      {
        id: 'pkg_starter_19',
        name: 'Starter Pass',
        price: 19,
        originalPrice: 199,
        tag: 'Instant Entry',
        badge: 'MICRO BOOST',
        color: '#10B981',
        description: 'Entry-level affiliate license with starter marketing toolkit.',
        commissionRate: 60, // 60% commission on referrals
        affiliatePayout: 11.40,
        platformFee: 7.60,
        leadsUnlocked: 10,
        features: [
          'Permanent Affiliate ID & Unique Referral Link',
          '60% Lifetime Referral Commission',
          '10 Hot Buyer Leads with WhatsApp Numbers',
          'Basic WhatsApp & Social Promo Templates',
          'Access to Basic Affiliate Training Hub',
          'Standard Wallet & Withdrawal Support'
        ],
        downloads: [
          { title: 'Affiliate Marketing Quickstart Guide (PDF)', size: '1.2 MB' },
          { title: 'Top 50 High-Converting WhatsApp Message Scripts', size: '0.8 MB' }
        ],
        popular: false
      },
      {
        id: 'pkg_kickstart_99',
        name: 'Kickstart Pro',
        price: 99,
        originalPrice: 499,
        tag: 'Fast Track',
        badge: 'POPULAR',
        color: '#3B82F6',
        description: 'Accelerated marketing kit with proven conversion funnels.',
        commissionRate: 60,
        affiliatePayout: 59.40,
        platformFee: 39.60,
        leadsUnlocked: 40,
        features: [
          'All Starter Pass Features',
          '40 Verified Hot Buyer Leads',
          'Instagram Reel & Story High-Converting Video Hooks',
          'Automated WhatsApp Follow-Up Copy Blueprint',
          'Direct Access to Community Support',
          'Fast-Track Withdrawal Processing'
        ],
        downloads: [
          { title: 'Viral Reel Mastery & Canva Templates Pack', size: '4.5 MB' },
          { title: 'WhatsApp DM Closing Masterclass Audio', size: '8.2 MB' }
        ],
        popular: true
      },
      {
        id: 'pkg_silver_299',
        name: 'Silver Growth Funnel',
        price: 299,
        originalPrice: 999,
        tag: 'High ROI',
        badge: 'BEST VALUE',
        color: '#8B5CF6',
        description: 'Comprehensive video training + targeted high-budget buyer leads.',
        commissionRate: 60,
        affiliatePayout: 179.40,
        platformFee: 119.60,
        leadsUnlocked: 120,
        features: [
          'All Kickstart Pro Benefits',
          '120 Premium Buyer Leads with City & Intent Data',
          'Complete Affiliate Funnel Landing Page Templates',
          'FB Ads & Google Ads Zero-Budget Growth Hacks',
          'Weekly Live Strategy Q&A Recordings',
          'Priority WhatsApp Helpdesk'
        ],
        downloads: [
          { title: 'Full Funnel Blueprint & Landing Page ZIP', size: '14.0 MB' },
          { title: 'Zero-Budget Organic Traffic Vault', size: '9.3 MB' }
        ],
        popular: false
      },
      {
        id: 'pkg_gold_699',
        name: 'Gold Mastery',
        price: 699,
        originalPrice: 1999,
        tag: 'Pro Marketer',
        badge: 'HIGH EARNER',
        color: '#F59E0B',
        description: 'Autonomous marketing system with high conversion rate and bulk buyer data.',
        commissionRate: 60,
        affiliatePayout: 419.40,
        platformFee: 279.60,
        leadsUnlocked: 350,
        features: [
          'All Silver Growth Benefits',
          '350 Verified Direct WhatsApp Buyer Contacts',
          'Done-For-You Daily WhatsApp Status Creatives',
          'Psychological Objection Handling Scripts',
          'Priority 2-Hour Wallet Withdrawals',
          'Leaderboard Earning Multiplier Boost'
        ],
        downloads: [
          { title: 'High-Ticket Closing Audio Scripts Vault', size: '22 MB' },
          { title: 'Ready-Made 365 Days Content Calendar', size: '5 MB' }
        ],
        popular: false
      },
      {
        id: 'pkg_diamond_1499',
        name: 'Diamond VIP Elite',
        price: 1499,
        originalPrice: 4999,
        tag: 'Ultimate Dominance',
        badge: 'VIP ELITE',
        color: '#EC4899',
        description: 'Complete commercial affiliate license, unlimited lead access & 1-on-1 blueprint.',
        commissionRate: 60,
        affiliatePayout: 899.40, // 60% of ₹1499
        platformFee: 599.60,    // 40% of ₹1499
        leadsUnlocked: 1000,
        features: [
          'Full Unrestricted Commercial Affiliate License',
          'Unlimited & Continuous Hot Buyer Lead Stream',
          'Instant Same-Day VIP Auto-Withdrawals',
          '1-on-1 Personalized Marketing Action Plan',
          'VIP Gold Crown Badge on Dashboard & Leaderboard',
          'Direct Dedicated VIP Telegram & WhatsApp Manager'
        ],
        downloads: [
          { title: 'VIP Diamond Millionaire Mastermind Toolkit', size: '45 MB' },
          { title: 'Exclusive Influencer Automation Bot Setup', size: '18 MB' }
        ],
        popular: false
      }
    ];

    defaultPackages.forEach(pkg => db.packages.insert(pkg));
    console.log('✅ Seeded default packages (₹19 to ₹1499)');
  }

  // 2. Setup System Settings
  if (db.settings.count() === 0) {
    db.settings.insert({
      id: 'system_config',
      siteName: 'AffiliateEmpire Bharat',
      tagline: 'Earn 60% Real Instant Commission on Every Referral',
      upiId: 'mrvikash@fam',
      merchantName: 'vikas',
      qrImageUrl: '/assets/merchant_qr.jpg',
      supportWhatsapp: '919876543210',
      supportEmail: 'support@affiliateempire.in',
      minWithdrawal: 50,
      autoApprovePayments: true, // Instant real unlock upon confirmation
      affiliateCommissionPercent: 60,
      adminCommissionPercent: 40,
      announcement: '🔥 Real Commercial Network: 60% Real Instant Cash to Wallet on ₹19 to ₹1499 Packages! Direct UPI Payouts Active!'
    });
    console.log('✅ Seeded real system settings (mrvikash@fam / vikas)');
  }

  // 3. Setup Default Admin Account
  const adminExists = db.users.findOne({ role: 'admin' });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin12345', 10);
    db.users.insert({
      id: 'USR_ADMIN_01',
      permanentId: 'AP-ADMIN99',
      fullName: 'Master Administrator',
      phone: '9876543210',
      email: 'admin@affiliateempire.in',
      passwordHash: passwordHash,
      role: 'admin',
      walletBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      purchasedPackages: ['pkg_diamond_1499'],
      activePackageId: 'pkg_diamond_1499',
      referredBy: null,
      referralCount: 0,
      isVerified: true
    });
    console.log('✅ Seeded master admin user (admin@affiliateempire.in / admin12345)');
  }

  // 4. Setup Verified Hot Buyer Leads Pool
  if (db.leads.count() === 0) {
    const seedLeads = [
      {
        id: 'lead_01',
        name: 'Rahul Sharma',
        city: 'Jaipur, Rajasthan',
        phone: '9829012345',
        category: 'Student / Part-Time Seeker',
        interestScore: 96,
        budget: '₹500 - ₹1500',
        pastInterest: 'Searched for Online Work from Home, Instagram Affiliate, Canva Designs',
        status: 'Hot Lead',
        recommendedPitch: 'Hi Rahul! Maine dekha aap online income and affiliate marketing me interested hain. Hamara verified ₹19 - ₹299 starter system aapko daily ₹1000+ earn karne me madad karega. Check kar lijiye:'
      },
      {
        id: 'lead_02',
        name: 'Priya Verma',
        city: 'Indore, MP',
        phone: '9754123456',
        category: 'Housewife / Side Hustle',
        interestScore: 92,
        budget: '₹200 - ₹1000',
        pastInterest: 'Watched Affiliate Marketing Reels, Clicked WhatsApp Ads for Reselling',
        status: 'Very High Intent',
        recommendedPitch: 'Namaste Priya ji! Ghar baithe mobile phone se 60% instant commission kamane ka genuine platform live ho chuka hai. Puri training aur leads bhi milti hain. Yaha dekhiye details:'
      },
      {
        id: 'lead_03',
        name: 'Amit Patel',
        city: 'Ahmedabad, Gujarat',
        phone: '9925012345',
        category: 'Digital Creator / Marketer',
        interestScore: 98,
        budget: '₹1499 VIP',
        pastInterest: 'Active on Telegram Digital Marketing groups, looking for high 60% commission products',
        status: 'VIP Buyer Prospect',
        recommendedPitch: 'Hey Amit! High-converting digital products platform with 60% instant payout to wallet. Instant UPI withdrawal available. Join our VIP tier:'
      },
      {
        id: 'lead_04',
        name: 'Vikas Kumar',
        city: 'Patna, Bihar',
        phone: '9431012345',
        category: 'College Student',
        interestScore: 89,
        budget: '₹19 - ₹99',
        pastInterest: 'Searched how to earn money on mobile, YouTube affiliate tutorial viewer',
        status: 'Ready to Start',
        recommendedPitch: 'Hello Vikas! Sirf ₹19 se aap apna khud ka affiliate business shuru kar sakte hain aur 60% direct commission kama sakte hain. Link dekhein:'
      },
      {
        id: 'lead_05',
        name: 'Sneha Deshmukh',
        city: 'Pune, Maharashtra',
        phone: '9822012345',
        category: 'Job Seeker',
        interestScore: 94,
        budget: '₹299 - ₹699',
        pastInterest: 'Completed beginner digital marketing module, searching for buyer contacts',
        status: 'Hot Lead',
        recommendedPitch: 'Hi Sneha! Ready-made leads aur promotional templates ke sath 60% commission affiliate business start karein. Instant payouts:'
      },
      {
        id: 'lead_06',
        name: 'Manish Rawat',
        city: 'Dehradun, UK',
        phone: '9412012345',
        category: 'Small Shop Owner',
        interestScore: 87,
        budget: '₹99 - ₹299',
        pastInterest: 'Interested in side business ideas with zero inventory',
        status: 'Active Followup',
        recommendedPitch: 'Namaste Manish ji! Bina kisi dukan ya stock ke sirf mobile se daily commission kamayein. Yaha start karein:'
      },
      {
        id: 'lead_07',
        name: 'Pooja Agarwal',
        city: 'Lucknow, UP',
        phone: '9450012345',
        category: 'Freelancer',
        interestScore: 95,
        budget: '₹699 - ₹1499',
        pastInterest: 'Looking for verified affiliate marketing network with prompt bank/UPI payouts',
        status: 'VIP Buyer Prospect',
        recommendedPitch: 'Hello Pooja! Join India’s top paying 60% commission network. Verified lead pool and marketing kit included:'
      },
      {
        id: 'lead_08',
        name: 'Deepak Rao',
        city: 'Hyderabad, Telangana',
        phone: '9848012345',
        category: 'Sales Executive',
        interestScore: 91,
        budget: '₹299 - ₹699',
        pastInterest: 'Attended webinar on social media monetization',
        status: 'High Intent',
        recommendedPitch: 'Hi Deepak! Turn your social media network into regular earnings with our automated affiliate system. 60% direct commission:'
      }
    ];

    seedLeads.forEach(lead => db.leads.insert(lead));
    console.log('✅ Seeded hot buyer leads pool with WhatsApp outreach');
  }

  // 5. Seed a demo top affiliate user to show on leaderboard
  const demoAffiliate = db.users.findOne({ email: 'rohit.earner@gmail.com' });
  if (!demoAffiliate) {
    const pw = await bcrypt.hash('pass123', 10);
    db.users.insert({
      id: 'USR_ROHIT_02',
      permanentId: 'AP-419208',
      fullName: 'Rohit K. Verma',
      phone: '9876500112',
      email: 'rohit.earner@gmail.com',
      passwordHash: pw,
      role: 'user',
      walletBalance: 4850.40,
      totalEarned: 24890.00,
      totalWithdrawn: 20000.00,
      purchasedPackages: ['pkg_diamond_1499'],
      activePackageId: 'pkg_diamond_1499',
      referredBy: 'AP-ADMIN99',
      referralCount: 42,
      isVerified: true
    });
    console.log('✅ Seeded demo top earner user (rohit.earner@gmail.com / pass123)');
  }
}

module.exports = { seedInitialData };
