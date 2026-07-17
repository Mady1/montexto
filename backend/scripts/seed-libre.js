require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this.lastID || this.changes);
    });
  });
}

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function seedLibre() {
  console.log('=== Seed: Organisation Libre + utilisateur + gateway Orange ===\n');

  // 1. Créer l'organisation Libre
  console.log('1. Création de l\'organisation Libre...');
  let org = await getOne("SELECT id FROM organizations WHERE name = 'Libre'");
  if (!org) {
    const orgId = await run(
      "INSERT INTO organizations (name, type, email, phone, address, sms_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['Libre', 'entreprise', 'contact@libre.ml', '+223 20 00 00 00', 'Bamako, Mali', 5000, 'active']
    );
    org = { id: orgId };
    console.log(`   Organisation créée: Libre (id=${org.id})`);
  } else {
    console.log(`   Organisation déjà existante (id=${org.id})`);
  }

  // 2. Récupérer le rôle org_admin
  const role = await getOne("SELECT id FROM roles WHERE name = 'org_admin'");
  if (!role) {
    console.error('   Rôle org_admin introuvable. Lancez d\'abord seed.js');
    process.exit(1);
  }

  // 3. Créer l'utilisateur test
  console.log('2. Création de l\'utilisateur test Libre...');
  const email = 'libre@montexto.com';
  const password = 'libre123';
  let user = await getOne('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) {
    const hashed = bcrypt.hashSync(password, 10);
    const userId = await run(
      'INSERT INTO users (email, password, first_name, last_name, phone, organization_id, role_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashed, 'Libre', 'Admin', '+22377000000', org.id, role.id, 'active']
    );
    user = { id: userId };
    console.log(`   Utilisateur créé: ${email} / ${password}`);
  } else {
    await run('UPDATE users SET organization_id = ?, role_id = ? WHERE id = ?', [org.id, role.id, user.id]);
    console.log(`   Utilisateur déjà existant (id=${user.id}), org/role mis à jour`);
  }

  // 4. Créer le gateway Orange Mali pour cette organisation
  console.log('3. Création du gateway Orange Mali pour Libre...');
  let gateway = await getOne('SELECT id FROM sms_gateways WHERE organization_id = ? AND provider = ?', [org.id, 'orange']);
  if (!gateway) {
    const config = JSON.stringify({
      clientId: process.env.ORANGE_CLIENT_ID || '',
      clientSecret: process.env.ORANGE_CLIENT_SECRET || '',
      senderAddress: '+2230000',
      senderName: 'Libre',
    });
    const gwId = await run(
      'INSERT INTO sms_gateways (name, provider, config, is_default, status, channel, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Orange Mali - Libre', 'orange', config, 1, 'active', 'sms', org.id]
    );
    console.log(`   Gateway créé: Orange Mali - Libre (id=${gwId})`);
  } else {
    console.log(`   Gateway déjà existant (id=${gateway.id})`);
  }

  // 5. Créer aussi un gateway mail SMTP pour Libre (utilise env vars)
  console.log('4. Création du gateway mail SMTP pour Libre...');
  let mailGw = await getOne('SELECT id FROM sms_gateways WHERE organization_id = ? AND channel = ?', [org.id, 'mail']);
  if (!mailGw) {
    const mailConfig = JSON.stringify({
      host: process.env.SMTP_HOST || '',
      port: process.env.SMTP_PORT || '587',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || 'no-reply@libre.ml',
    });
    const gwId = await run(
      'INSERT INTO sms_gateways (name, provider, config, is_default, status, channel, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['SMTP - Libre', 'smtp', mailConfig, 1, 'active', 'mail', org.id]
    );
    console.log(`   Gateway mail créé: SMTP - Libre (id=${gwId})`);
  } else {
    console.log(`   Gateway mail déjà existant (id=${mailGw.id})`);
  }

  console.log('\n=== Seed Libre terminé ===');
  console.log(`Organisation: Libre (id=${org.id})`);
  console.log(`Utilisateur:  ${email} / ${password}`);
  console.log('Gateway SMS:  Orange Mali (senderAddress=+2230000, senderName=Libre)');
  console.log('Gateway Mail: SMTP (via env vars)');
  db.close();
}

seedLibre().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
