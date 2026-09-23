const db = require('./db');
const bcrypt = require('bcryptjs');

async function seedInitialData() {
  // 1. Setup Packages (₹19 to ₹1499)
  const defaultPackages = [
    {
      id: 'pkg_starter_19',
      name: 'Starter Pass',
      price: 19,
      originalPrice: 199,
      tag: 'Instant Entry',
      badge: 'MICRO BOOST',
      color: '#10B981',
      description: 'Entry-level affiliate license with starter toolkit & 5 direct WhatsApp buyer leads.',
      commissionRate: 60,
      affiliatePayout: 11.40,
      platformFee: 7.60,
      leadsUnlocked: 5, // Exactly 5 leads for small package
      features: [
        'Permanent Affiliate ID & Permanent Referral Link',
        '60% Lifetime Referral Commission',
        '5 Verified Hot Buyer Leads with WhatsApp Numbers',
        'Basic WhatsApp & Social Promo Templates',
        'Quickstart Video & Script Guide',
        'Standard Wallet & Withdrawal Support'
      ],
      services: [
        { title: 'Step-by-Step 15-Minute Affiliate Setup Guide', icon: '🚀' },
        { title: 'Top 10 High-Converting WhatsApp Starter Scripts', icon: '📱' },
        { title: '5 Verified Direct WhatsApp Prospects', icon: '🔥' }
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
      description: 'Accelerated marketing kit with proven conversion funnels & 25 buyer leads.',
      commissionRate: 60,
      affiliatePayout: 59.40,
      platformFee: 39.60,
      leadsUnlocked: 25,
      features: [
        'All Starter Pass Features',
        '25 Verified Hot Buyer Leads with WhatsApp',
        'Instagram Reel & Story Video Hooks Pack',
        'Automated WhatsApp Follow-Up Copy Blueprint',
        'Direct Access to Community Support',
        'Fast-Track Withdrawal Processing'
      ],
      services: [
        { title: 'Viral Reel Mastery & Canva Status Pack (50+ Designs)', icon: '🎨' },
        { title: 'WhatsApp DM Objection Handling Audio Masterclass', icon: '🎙️' },
        { title: '25 High-Intent Buyer WhatsApp Pool', icon: '🔥' }
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
      description: 'Complete video training + 75 targeted high-budget buyer contacts.',
      commissionRate: 60,
      affiliatePayout: 179.40,
      platformFee: 119.60,
      leadsUnlocked: 75,
      features: [
        'All Kickstart Pro Benefits',
        '75 Premium Buyer Leads with City & Intent Data',
        'Complete Affiliate Funnel Landing Page Templates',
        'Organic Traffic Vault (FB, Instagram, Telegram)',
        'Weekly Live Strategy Q&A Recordings',
        'Priority WhatsApp Helpdesk'
      ],
      services: [
        { title: 'Automated Sales Funnel Landing Page Pack', icon: '💻' },
        { title: 'Zero-Budget Organic Traffic Mastery Vault', icon: '📈' },
        { title: '75 High-Ticket Buyer Contacts', icon: '💎' }
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
      description: 'Autonomous selling system with high conversion rate & 200 bulk buyer contacts.',
      commissionRate: 60,
      affiliatePayout: 419.40,
      platformFee: 279.60,
      leadsUnlocked: 200,
      features: [
        'All Silver Growth Benefits',
        '200 Verified Direct WhatsApp Buyer Contacts',
        'Done-For-You Daily WhatsApp Status Creatives',
        'Psychological Objection Handling Scripts',
        'Priority 2-Hour Wallet Withdrawals',
        'Leaderboard Earning Multiplier Boost'
      ],
      services: [
        { title: 'High-Ticket Closing Audio Scripts Vault', icon: '🎧' },
        { title: 'Ready-Made 365 Days Content Calendar', icon: '📅' },
        { title: '200 Direct WhatsApp Buyer Contacts', icon: '🔥' }
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
      description: 'Complete commercial affiliate license, 500+ lead access & 1-on-1 blueprint.',
      commissionRate: 60,
      affiliatePayout: 899.40,
      platformFee: 599.60,
      leadsUnlocked: 500,
      features: [
        'Full Unrestricted Commercial Affiliate License',
        '500+ Verified Hot Buyer Lead Stream',
        'Instant Same-Day VIP Auto-Withdrawals',
        '1-on-1 Personalized Marketing Action Plan',
        'VIP Gold Crown Badge on Dashboard & Leaderboard',
        'Direct Dedicated VIP Telegram & WhatsApp Manager'
      ],
      services: [
        { title: 'VIP Millionaire Affiliate Mastermind Toolkit', icon: '👑' },
        { title: 'Exclusive Influencer Automation Bot Blueprint', icon: '🤖' },
        { title: '500+ Direct VIP Buyer Leads Stream', icon: '🚀' }
      ],
      popular: false
    }
  ];

  // Overwrite packages with updated 5 leads structure
  db.packages.data = defaultPackages;
  db.packages.save();
  console.log('✅ Synchronized packages (₹19 to ₹1499) with 5 leads starter structure');

  // 2. Setup System Settings
  db.settings.data = [{
    id: 'system_config',
    siteName: 'AffiliateEmpire Bharat',
    tagline: 'Earn 60% Real Instant Commission on Every Referral',
    upiId: 'mrvikash@fam',
    merchantName: 'vikas',
    qrImageUrl: '/assets/merchant_qr.jpg',
    supportWhatsapp: '919876543210',
    supportEmail: 'support@affiliateempire.in',
    minWithdrawal: 50,
    autoApprovePayments: true,
    affiliateCommissionPercent: 60,
    adminCommissionPercent: 40,
    announcement: '🔥 Real Commercial Network: 60% Instant Cash on ₹19 to ₹1499 Packages! Direct UPI Withdrawals Active!'
  }];
  db.settings.save();

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
  }

  // 4. Setup Rich Pool of Verified Indian Hot Leads with Real Cities & WhatsApp Contacts
  const seedLeads = [
    {
      id: 'lead_01',
      name: 'Rahul Sharma',
      city: 'Jaipur, Rajasthan',
      phone: '9829012345',
      category: 'Student / Part-Time Seeker',
      interestScore: 96,
      budget: '₹500 - ₹1500',
      pastInterest: 'Searched for Online Work from Home & Instagram Affiliate',
      status: '🔥 Hot Lead',
      recommendedPitch: 'Hi Rahul! Maine dekha aap online income and affiliate marketing me interested hain. Hamara verified ₹19 - ₹299 starter system aapko daily ₹1000+ earn karne me madad karega. Check details:'
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
      status: '⚡ High Intent',
      recommendedPitch: 'Namaste Priya ji! Ghar baithe mobile phone se 60% instant commission kamane ka genuine platform live ho chuka hai. Puri training aur leads bhi milti hain. Yaha dekhiye:'
    },
    {
      id: 'lead_03',
      name: 'Amit Patel',
      city: 'Ahmedabad, Gujarat',
      phone: '9925012345',
      category: 'Digital Creator / Marketer',
      interestScore: 98,
      budget: '₹1499 VIP',
      pastInterest: 'Active on Telegram Digital Marketing groups, looking for 60% commission products',
      status: '👑 VIP Buyer',
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
      status: '🔥 Hot Lead',
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
      status: '⚡ High Intent',
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
      status: '⚡ Active Followup',
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
      pastInterest: 'Looking for verified affiliate marketing network with prompt UPI payouts',
      status: '👑 VIP Buyer',
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
      status: '🔥 Hot Lead',
      recommendedPitch: 'Hi Deepak! Turn your network into regular earnings with our automated affiliate system. 60% direct commission:'
    },
    {
      id: 'lead_09',
      name: 'Kunal Singhania',
      city: 'Kolkata, WB',
      phone: '9830012345',
      category: 'B.Com Student',
      interestScore: 93,
      budget: '₹99 - ₹299',
      pastInterest: 'Searched part time mobile work for students',
      status: '🔥 Hot Lead',
      recommendedPitch: 'Hi Kunal! Check this genuine 60% affiliate commission platform. You can start with just ₹19 pass today:'
    },
    {
      id: 'lead_10',
      name: 'Ananya Roy',
      city: 'Bhopal, MP',
      phone: '9752012345',
      category: 'Content Creator',
      interestScore: 97,
      budget: '₹299 - ₹1499',
      pastInterest: 'Instagram reel creator seeking monetization products',
      status: '👑 VIP Buyer',
      recommendedPitch: 'Hey Ananya! Monetize your followers with 60% direct commission on verified digital courses. Link:'
    }
  ];

  db.leads.data = seedLeads;
  db.leads.save();
  console.log('✅ Seeded verified hot buyer leads pool');
}

module.exports = { seedInitialData };
