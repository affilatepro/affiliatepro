const RENDER_API_KEY = 'rnd_TKs4ePKZZ5iNGo37ylXOdtTkgsaG';

async function deployToRender() {
  console.log('🚀 Connecting to Render API...');

  // 1. Get Owner ID
  const ownersRes = await fetch('https://api.render.com/v1/owners', {
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  const ownersData = await ownersRes.json();
  console.log('✅ Owners response:', ownersData);

  if (!ownersData || ownersData.length === 0) {
    console.error('❌ Could not find Render Owner Account');
    return;
  }

  const ownerId = ownersData[0].owner.id;
  console.log(`✅ Using Owner ID: ${ownerId} (${ownersData[0].owner.name || ownersData[0].owner.email})`);

  // 2. Create Web Service
  const servicePayload = {
    type: 'web_service',
    name: 'affiliatepro',
    ownerId: ownerId,
    repo: 'https://github.com/affilatepro/affiliatepro',
    branch: 'main',
    autoDeploy: 'yes',
    serviceDetails: {
      env: 'node',
      plan: 'free',
      region: 'singapore',
      envSpecificDetails: {
        buildCommand: 'npm install',
        startCommand: 'npm start'
      },
      envVars: [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'PORT', value: '10000' }
      ]
    }
  };

  console.log('📦 Creating Web Service on Render...');

  const createRes = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(servicePayload)
  });

  const createData = await createRes.json();
  console.log('🎉 Render Service Created Response:', JSON.stringify(createData, null, 2));

  if (createData.service) {
    console.log(`\n======================================================`);
    console.log(`🌐 LIVE RENDER URL: ${createData.service.serviceDetails.url}`);
    console.log(`⚡ Service Name: ${createData.service.name}`);
    console.log(`🆔 Service ID: ${createData.service.id}`);
    console.log(`======================================================\n`);
  }
}

deployToRender().catch(console.error);
