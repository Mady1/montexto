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

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function seedTestData() {
  console.log('=== Insertion des donnees de test ===\n');

  // ─── Migration: assurer le schéma campaign_recipients ──────────
  const columns = await getAll('PRAGMA table_info(campaign_recipients)');
  const hasOrgId = columns.some(c => c.name === 'organization_id');
  if (!hasOrgId) {
    console.log('Migration: ajout organization_id a campaign_recipients...');
    await run('ALTER TABLE campaign_recipients ADD COLUMN organization_id INTEGER');
  }
  const hasCampaignIdNullable = columns.find(c => c.name === 'campaign_id');
  if (hasCampaignIdNullable && hasCampaignIdNullable.notnull === 1) {
    // SQLite ne supporte pas ALTER COLUMN, on recree la table
    console.log('Migration: recreation campaign_recipients pour campaign_id nullable...');
    await run('ALTER TABLE campaign_recipients RENAME TO campaign_recipients_old');
    await run(`CREATE TABLE campaign_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      organization_id INTEGER,
      contact_id INTEGER,
      phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      twilio_sid TEXT,
      error_message TEXT,
      sent_at DATETIME,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
    )`);
    await run('INSERT INTO campaign_recipients (campaign_id, contact_id, phone, status, twilio_sid, error_message, sent_at) SELECT campaign_id, contact_id, phone, status, twilio_sid, error_message, sent_at FROM campaign_recipients_old');
    await run('DROP TABLE campaign_recipients_old');
  }

  // ─── Recuperer les IDs existants ───────────────────────────────
  const roles = await getAll('SELECT id, name FROM roles');
  const roleMap = {};
  roles.forEach(r => roleMap[r.name] = r.id);

  const orgs = await getAll('SELECT id, name FROM organizations');
  
  // ─── 1. Organisations supplementaires ──────────────────────────
  console.log('1. Organisations...');
  const orgNames = ['BDM-SA', 'Orange Mali', 'CMDT'];
  const orgIds = { 'Montexto Demo': orgs[0].id };
  for (const name of orgNames) {
    const existing = await getOne('SELECT id FROM organizations WHERE name = ?', [name]);
    if (existing) {
      orgIds[name] = existing.id;
    } else {
      const id = await run(
        'INSERT INTO organizations (name, type, email, phone, address, sms_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, name.includes('BDM') ? 'banque' : name.includes('Orange') ? 'telecom' : 'entreprise',
         `contact@${name.toLowerCase().replace(/[\s-]/g, '')}.ml`,
         '+223 20 22 00 00',
         'Bamako, Mali',
         Math.floor(Math.random() * 5000) + 1000,
         'active']
      );
      orgIds[name] = id;
    }
  }
  console.log(`   ${Object.keys(orgIds).length} organisations`);

  // ─── 2. Utilisateurs supplementaires ───────────────────────────
  console.log('2. Utilisateurs...');
  const testUsers = [
    { email: 'resp.com@montexto.com', password: 'resp123', firstName: 'Aminata', lastName: 'Koné', phone: '+22376000001', org: 'Montexto Demo', role: 'resp_com' },
    { email: 'operator@montexto.com', password: 'op123', firstName: 'Souleymane', lastName: 'Diarra', phone: '+22376000002', org: 'Montexto Demo', role: 'operator' },
    { email: 'auditor@montexto.com', password: 'audit123', firstName: 'Fatoumata', lastName: 'Diabaté', phone: '+22376000003', org: 'Montexto Demo', role: 'auditor' },
    { email: 'admin.bdm@montexto.com', password: 'bdm123', firstName: 'Ibrahim', lastName: 'Touré', phone: '+22376000004', org: 'BDM-SA', role: 'org_admin' },
    { email: 'com.bdm@montexto.com', password: 'bdmcom123', firstName: 'Awa', lastName: 'Sidibé', phone: '+22376000005', org: 'BDM-SA', role: 'resp_com' },
    { email: 'admin.orange@montexto.com', password: 'orange123', firstName: 'Sékou', lastName: 'Diallo', phone: '+22376000006', org: 'Orange Mali', role: 'org_admin' },
    { email: 'op.cmdt@montexto.com', password: 'cmdt123', firstName: 'Mariam', lastName: 'Cissé', phone: '+22376000007', org: 'CMDT', role: 'operator' },
  ];

  const userIds = {};
  for (const u of testUsers) {
    const existing = await getOne('SELECT id FROM users WHERE email = ?', [u.email]);
    if (existing) {
      userIds[u.email] = existing.id;
    } else {
      const hashed = bcrypt.hashSync(u.password, 10);
      const id = await run(
        'INSERT INTO users (email, password, first_name, last_name, phone, organization_id, role_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [u.email, hashed, u.firstName, u.lastName, u.phone, orgIds[u.org], roleMap[u.role], 'active']
      );
      userIds[u.email] = id;
    }
  }
  // Recuperer aussi les users existants
  const adminUser = await getOne('SELECT id FROM users WHERE email = ?', ['admin@montexto.com']);
  const demoUser = await getOne('SELECT id FROM users WHERE email = ?', ['demo@montexto.com']);
  if (adminUser) userIds['admin@montexto.com'] = adminUser.id;
  if (demoUser) userIds['demo@montexto.com'] = demoUser.id;
  console.log(`   ${Object.keys(userIds).length} utilisateurs`);

  // ─── 3. Groupes de contacts ────────────────────────────────────
  console.log('3. Groupes de contacts...');
  const groups = [
    { name: 'Clients VIP', desc: 'Clients haut de gamme', org: 'Montexto Demo', user: 'demo@montexto.com' },
    { name: 'Prospects', desc: 'Prospects a convertir', org: 'Montexto Demo', user: 'demo@montexto.com' },
    { name: 'Fournisseurs', desc: 'Liste des fournisseurs', org: 'Montexto Demo', user: 'operator@montexto.com' },
    { name: 'Clients Banque', desc: 'Clients particulier', org: 'BDM-SA', user: 'admin.bdm@montexto.com' },
    { name: 'Clients Entreprise', desc: 'Clients corporate', org: 'BDM-SA', user: 'com.bdm@montexto.com' },
    { name: 'Abonnes Orange', desc: 'Abonnes mobile', org: 'Orange Mali', user: 'admin.orange@montexto.com' },
    { name: 'Personnel CMDT', desc: 'Employes internes', org: 'CMDT', user: 'op.cmdt@montexto.com' },
  ];
  const groupIds = {};
  for (const g of groups) {
    const existing = await getOne('SELECT id FROM contact_groups WHERE name = ? AND organization_id = ?', [g.name, orgIds[g.org]]);
    if (existing) {
      groupIds[`${g.org}:${g.name}`] = existing.id;
    } else {
      const id = await run(
        'INSERT INTO contact_groups (user_id, organization_id, name, description) VALUES (?, ?, ?, ?)',
        [userIds[g.user], orgIds[g.org], g.name, g.desc]
      );
      groupIds[`${g.org}:${g.name}`] = id;
    }
  }
  console.log(`   ${Object.keys(groupIds).length} groupes`);

  // ─── 4. Contacts ───────────────────────────────────────────────
  console.log('4. Contacts...');
  const firstNames = ['Mamadou', 'Fatoumata', 'Oumar', 'Aminata', 'Boubacar', 'Awa', 'Souleymane', 'Djénéba',
    'Sékou', 'Aïssata', 'Bakary', 'Kadiatou', 'Adama', 'Rokia', 'Yacouba', 'Assitan', 'Lassana', 'Nana',
    'Moussa', 'Bintou', 'Drissa', 'Sitan', 'Alou', 'Korotoumou', 'Cheick', 'Hawa', 'Mahamadou', 'Salimata', 'Issa', 'Fanta'];
  const lastNames = ['Traoré', 'Diarra', 'Keïta', 'Coulibaly', 'Diallo', 'Touré', 'Cissé', 'Konaté', 'Sissoko',
    'Sangaré', 'Camara', 'Sidibé', 'Maïga', 'Haïdara', 'Doumbia', 'Kouyaté', 'Dembélé', 'Diakité', 'Ba', 'Sow'];

  let contactCount = 0;
  for (const [orgName, orgId] of Object.entries(orgIds)) {
    const orgGroups = Object.entries(groupIds).filter(([k]) => k.startsWith(`${orgName}:`));
    const numContacts = 25 + Math.floor(Math.random() * 15);
    for (let i = 0; i < numContacts; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const mobilePrefix = ['6', '7', '9'][Math.floor(Math.random() * 3)];
      const phone = `+223 ${mobilePrefix}${Math.floor(Math.random() * 10)} ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, '')}${i}@${orgName.toLowerCase().replace(/[\s-]/g, '')}.ml`;
      const grp = orgGroups.length > 0 ? orgGroups[Math.floor(Math.random() * orgGroups.length)][1] : null;
      const userKeys = Object.entries(userIds).filter(([k]) => {
        // Find users in this org
        return Object.entries(orgIds).find(([on]) => on === orgName) !== undefined;
      });
      const userId = Object.values(userIds)[Math.floor(Math.random() * Object.keys(userIds).length)];

      await run(
        'INSERT INTO contacts (user_id, organization_id, group_id, first_name, last_name, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, orgId, grp, fn, ln, phone, email]
      );
      contactCount++;
    }
  }
  console.log(`   ${contactCount} contacts inseres`);

  // ─── 5. Catalogue de modeles ───────────────────────────────────
  console.log('5. Catalogue...');
  const templates = [
    { name: 'Bienvenue', content: 'Bienvenue chez {entreprise}! Votre compte a ete cree avec succes. Merci de votre confiance.' },
    { name: 'Promotion', content: 'Profitez de -{reduction}% sur tous nos produits ce weekend seulement! Code promo: {code}' },
    { name: 'Rappel RDV', content: 'Bonjour {nom}, rappel de votre rendez-vous le {date} a {heure}. Merci de confirmer votre presence.' },
    { name: 'Solde compte', content: 'Votre solde au {date} est de {solde} FCFA. Consultez votre compte pour plus de details.' },
    { name: 'Paiement recu', content: 'Nous avons recu votre paiement de {montant} FCFA. Reference: {ref}. Merci!' },
    { name: 'Notification livraison', content: 'Votre commande #{commande} est en cours de livraison. Livraison prevue: {date}' },
    { name: 'Voeux fêtes', content: 'Toute l\'equipe vous souhaite de joyeuses fetes de fin d\'annee! Que 2025 vous apporte bonheur et prosperite.' },
    { name: 'Maintenance', content: 'Info maintenance: notre service sera indisponible le {date} de {heure_debut} a {heure_fin}. Merci de votre comprehension.' },
  ];
  let catalogCount = 0;
  for (const [orgName, orgId] of Object.entries(orgIds)) {
    const userId = Object.values(userIds)[0];
    for (const t of templates.slice(0, 5)) {
      await run(
        'INSERT INTO catalog_items (user_id, organization_id, name, content, type) VALUES (?, ?, ?, ?, ?)',
        [userId, orgId, t.name, t.content, 'sms']
      );
      catalogCount++;
    }
  }
  console.log(`   ${catalogCount} modeles de catalogue`);

  // ─── 6. Campagnes ──────────────────────────────────────────────
  console.log('6. Campagnes...');
  const campaignData = [
    { name: 'Promo Nouvel An', message: 'Bonne annee 2025! Profitez de -20% sur tous nos services ce mois de janvier.', org: 'Montexto Demo', user: 'resp.com@montexto.com', status: 'sent', delivered: 45, failed: 3, pending: 0 },
    { name: 'Rappel Factures', message: 'Bonjour, votre facture du mois est disponible. Montant: 25000 FCFA. Echeance: 31/01/2025.', org: 'Montexto Demo', user: 'resp.com@montexto.com', status: 'sent', delivered: 30, failed: 1, pending: 0 },
    { name: 'Lancement Produit', message: 'Nouveau produit disponible! Decouvrez notre nouvelle offre mobile. RDV en agence.', org: 'Montexto Demo', user: 'resp.com@montexto.com', status: 'draft', delivered: 0, failed: 0, pending: 50 },
    { name: 'Voeux fêtes', message: 'Toute l\'equipe vous souhaite de joyeuses fetes! Merci de votre fidelite.', org: 'Montexto Demo', user: 'demo@montexto.com', status: 'scheduled', delivered: 0, failed: 0, pending: 80 },
    { name: 'Promo Credit', message: 'Besoin de credit? Profitez de nos taux preferentiels ce mois! Contactez-nous au 20 22 00 00.', org: 'BDM-SA', user: 'com.bdm@montexto.com', status: 'sent', delivered: 60, failed: 5, pending: 0 },
    { name: 'Info Maintenance', message: 'Info: nos services en ligne seront indisponibles le 15/02 de 02h a 04h. Merci de votre comprehension.', org: 'BDM-SA', user: 'com.bdm@montexto.com', status: 'validated', delivered: 0, failed: 0, pending: 120 },
    { name: 'Offre Internet', message: 'Nouvelle offre internet 4G+! 50 Go pour 5000 FCFA. Activez en composant #144#', org: 'Orange Mali', user: 'admin.orange@montexto.com', status: 'sent', delivered: 200, failed: 10, pending: 0 },
    { name: 'Campagne Annulee', message: 'Message test annule', org: 'Orange Mali', user: 'admin.orange@montexto.com', status: 'cancelled', delivered: 0, failed: 0, pending: 0 },
    { name: 'Reunion Staff', message: 'Rappel: reunion generale du personnel le 20/02 a 09h en salle de conference.', org: 'CMDT', user: 'op.cmdt@montexto.com', status: 'sent', delivered: 15, failed: 0, pending: 0 },
    { name: 'Paie du mois', message: 'Votre salaire du mois a ete verse. Montant net: 450000 FCFA. Compte: XXXX4521.', org: 'CMDT', user: 'op.cmdt@montexto.com', status: 'draft', delivered: 0, failed: 0, pending: 35 },
  ];

  const campaignIds = [];
  for (const c of campaignData) {
    const total = c.delivered + c.failed + c.pending;
    const cost = total * 15;
    const scheduleDate = c.status === 'scheduled' ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
    const createdDate = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString();

    const id = await run(
      'INSERT INTO campaigns (user_id, organization_id, name, message, type, status, scheduled_at, total_recipients, delivered, failed, pending, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userIds[c.user], orgIds[c.org], c.name, c.message, 'sms', c.status, scheduleDate, total, c.delivered, c.failed, c.pending, cost, createdDate]
    );
    campaignIds.push({ id, ...c, total });

    // Inserer des recipients pour les campagnes envoyees
    if (c.status === 'sent' && c.delivered > 0) {
      const contacts = await getAll('SELECT id, phone FROM contacts WHERE organization_id = ? LIMIT ?', [orgIds[c.org], c.delivered]);
      for (const contact of contacts) {
        await run(
          'INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)',
          [id, orgIds[c.org], contact.id, contact.phone, 'delivered', new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString()]
        );
      }
      // Quelques echecs
      const failedContacts = await getAll('SELECT id, phone FROM contacts WHERE organization_id = ? LIMIT ?', [orgIds[c.org], c.failed]);
      for (const contact of failedContacts) {
        await run(
          'INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone, status, error_message, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, orgIds[c.org], contact.id, contact.phone, 'failed', 'Numero invalide', new Date().toISOString()]
        );
      }
    }
  }
  console.log(`   ${campaignIds.length} campagnes`);

  // ─── 7. SMS standalone (historique) ────────────────────────────
  console.log('7. SMS standalone...');
  let smsCount = 0;
  for (const [orgName, orgId] of Object.entries(orgIds)) {
    const contacts = await getAll('SELECT phone FROM contacts WHERE organization_id = ? LIMIT 10', [orgId]);
    for (const contact of contacts) {
      await run(
        'INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)',
        [null, orgId, null, contact.phone, Math.random() > 0.1 ? 'delivered' : 'failed', new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString()]
      );
      smsCount++;
    }
  }
  console.log(`   ${smsCount} SMS standalone`);

  // ─── 8. Passerelles SMS ────────────────────────────────────────
  console.log('8. Passerelles SMS...');
  const gateways = [
    { name: 'Twilio Principal', provider: 'twilio', config: '{"accountSid":"ACxxx","authToken":"xxx","from":"+1234567890"}', isDefault: 1 },
    { name: 'Orange SMS API', provider: 'orange', config: '{"clientId":"xxx","clientSecret":"xxx","senderAddress":"+22376000000"}', isDefault: 0 },
    { name: 'MT Mobile Mali', provider: 'mt', config: '{"apiKey":"xxx","sender":"MONTX"}', isDefault: 0 },
  ];
  for (const g of gateways) {
    const existing = await getOne('SELECT id FROM sms_gateways WHERE name = ?', [g.name]);
    if (!existing) {
      await run(
        'INSERT INTO sms_gateways (name, provider, config, is_default, status) VALUES (?, ?, ?, ?, ?)',
        [g.name, g.provider, g.config, g.isDefault, g.isDefault ? 'active' : 'inactive']
      );
    }
  }
  console.log(`   ${gateways.length} passerelles`);

  // ─── 9. Cles API ───────────────────────────────────────────────
  console.log('9. Cles API...');
  const crypto = require('crypto');
  for (const [email, uid] of Object.entries(userIds)) {
    const user = await getOne('SELECT organization_id FROM users WHERE id = ?', [uid]);
    const existing = await getOne('SELECT id FROM api_keys WHERE user_id = ?', [uid]);
    if (!existing) {
      const key = 'mtx_' + crypto.randomBytes(16).toString('hex');
      await run(
        'INSERT INTO api_keys (user_id, organization_id, name, key_value) VALUES (?, ?, ?, ?)',
        [uid, user.organization_id, `Cle de ${email}`, key]
      );
    }
  }
  console.log(`   ${Object.keys(userIds).length} cles API`);

  // ─── 10. Recharges ─────────────────────────────────────────────
  console.log('10. Recharges...');
  const rechargeMethods = ['Manuel', 'Orange Money', 'Moov Money', 'Virement'];
  let rechargeCount = 0;
  for (const [orgName, orgId] of Object.entries(orgIds)) {
    const numRecharges = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numRecharges; i++) {
      const amount = [10000, 25000, 50000, 100000, 200000][Math.floor(Math.random() * 5)];
      const method = rechargeMethods[Math.floor(Math.random() * rechargeMethods.length)];
      const date = new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString();
      await run(
        'INSERT INTO recharges (user_id, organization_id, amount, payment_method, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [Object.values(userIds)[0], orgId, amount, method, Math.random() > 0.05 ? 'success' : 'failed', date]
      );
      rechargeCount++;
    }
  }
  console.log(`   ${rechargeCount} recharges`);

  // ─── 11. Transactions de credits SMS ───────────────────────────
  console.log('11. Transactions de credits SMS...');
  let txnCount = 0;
  for (const [orgName, orgId] of Object.entries(orgIds)) {
    const org = await getOne('SELECT sms_balance FROM organizations WHERE id = ?', [orgId]);
    // Credit
    await run(
      'INSERT INTO sms_credit_transactions (organization_id, amount, type, description, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, 10000, 'credit', 'Recharge initiale', 10000, new Date(Date.now() - 30 * 86400000).toISOString()]
    );
    // Debit
    await run(
      'INSERT INTO sms_credit_transactions (organization_id, amount, type, description, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, -500, 'debit', 'Campagne Promo Nouvel An', 9500, new Date(Date.now() - 20 * 86400000).toISOString()]
    );
    // Credit
    await run(
      'INSERT INTO sms_credit_transactions (organization_id, amount, type, description, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, 5000, 'credit', 'Recharge Orange Money', org.sms_balance, new Date(Date.now() - 10 * 86400000).toISOString()]
    );
    txnCount += 3;
  }
  console.log(`   ${txnCount} transactions`);

  // ─── 12. Historique de connexion ───────────────────────────────
  console.log('12. Historique de connexion...');
  let loginCount = 0;
  for (const [email, uid] of Object.entries(userIds)) {
    const numLogins = 3 + Math.floor(Math.random() * 7);
    for (let i = 0; i < numLogins; i++) {
      const success = Math.random() > 0.15;
      const date = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000 - Math.floor(Math.random() * 86400000)).toISOString();
      await run(
        'INSERT INTO login_history (user_id, ip_address, user_agent, success, created_at) VALUES (?, ?, ?, ?, ?)',
        [uid, `192.168.1.${Math.floor(Math.random() * 255)}`, 'Mozilla/5.0 Chrome/120', success ? 1 : 0, date]
      );
      loginCount++;
    }
    // Mettre a jour last_login
    await run('UPDATE users SET last_login = ? WHERE id = ?', [new Date(Date.now() - Math.floor(Math.random() * 5) * 86400000).toISOString(), uid]);
  }
  console.log(`   ${loginCount} entrees de connexion`);

  // ─── 13. Logs d'audit ──────────────────────────────────────────
  console.log('13. Logs d\'audit...');
  const auditActions = [
    'auth.login', 'auth.logout', 'auth.register', 'campaign.create', 'campaign.update',
    'campaign.validate', 'campaign.cancel', 'campaign.delete', 'contact.create', 'contact.update',
    'contact.delete', 'user.create', 'user.update', 'user.delete', 'org.update', 'org.credits_add',
    'sms.send', 'sms.send_bulk', 'gateway.create', 'gateway.update',
  ];
  let auditCount = 0;
  for (let i = 0; i < 50; i++) {
    const action = auditActions[Math.floor(Math.random() * auditActions.length)];
    const userId = Object.values(userIds)[Math.floor(Math.random() * Object.keys(userIds).length)];
    const user = await getOne('SELECT organization_id FROM users WHERE id = ?', [userId]);
    const date = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000 - Math.floor(Math.random() * 86400000)).toISOString();
    await run(
      'INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, user?.organization_id || null, action,
       ['campaign', 'contact', 'user', 'organization'][Math.floor(Math.random() * 4)],
       Math.floor(Math.random() * 100) + 1,
       `Action ${action} effectuee`,
       `192.168.1.${Math.floor(Math.random() * 255)}`,
       'Mozilla/5.0 Chrome/120',
       date]
    );
    auditCount++;
  }
  console.log(`   ${auditCount} logs d'audit`);

  // ─── 14. Notifications ─────────────────────────────────────────
  console.log('14. Notifications...');
  const notifData = [
    { title: 'Campagne envoyée', message: 'Votre campagne "Promo Nouvel An" a été envoyée à 45 destinataires.', type: 'success', link: '/campaigns' },
    { title: 'Campagne planifiée', message: 'La campagne "Voeux fêtes" est planifiée pour le 31/12/2024.', type: 'info', link: '/campaigns' },
    { title: 'Crédits SMS faibles', message: 'Le solde SMS de votre organisation est inférieur à 500. Pensez à recharger.', type: 'warning', link: '/organizations' },
    { title: 'Nouvel utilisateur', message: 'Un nouvel utilisateur a rejoint votre organisation.', type: 'info', link: '/users' },
    { title: 'Campagne validée', message: 'La campagne "Info Maintenance" a été validée et est prête à envoyer.', type: 'success', link: '/campaigns' },
    { title: 'Échec d\'envoi', message: '3 SMS ont échoué lors de la dernière campagne. Vérifiez les numéros.', type: 'error', link: '/campaigns' },
    { title: 'Recharge effectuée', message: 'Une recharge de 50000 FCFA a été effectuée via Orange Money.', type: 'success', link: '/statistics' },
    { title: 'Mot de passe modifié', message: 'Votre mot de passe a été modifié avec succès.', type: 'info', link: '/profile' },
  ];
  let notifCount = 0;
  for (const [email, uid] of Object.entries(userIds)) {
    const user = await getOne('SELECT organization_id FROM users WHERE id = ?', [uid]);
    // 2-4 notifications per user
    const numNotifs = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numNotifs; i++) {
      const n = notifData[Math.floor(Math.random() * notifData.length)];
      const isRead = Math.random() > 0.5 ? 1 : 0;
      const date = new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString();
      await run(
        'INSERT INTO notifications (user_id, organization_id, title, message, type, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uid, user?.organization_id || null, n.title, n.message, n.type, n.link, isRead, date]
      );
      notifCount++;
    }
  }
  // Org-wide notifications
  for (const [orgName, orgId] of Object.entries(orgIds)) {
    await run(
      'INSERT INTO notifications (user_id, organization_id, title, message, type, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [null, orgId, 'Maintenance planifiée', 'Une maintenance est prévue ce weekend. Les envois SMS seront suspendus.', 'warning', null, 0, new Date(Date.now() - 86400000).toISOString()]
    );
    notifCount++;
  }
  console.log(`   ${notifCount} notifications`);

  // ─── 15. OTP codes (un expired pour test) ──────────────────────
  console.log('15. OTP codes...');
  const expiredCode = await getOne('SELECT id FROM otp_codes WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userIds['demo@montexto.com']]);
  if (!expiredCode) {
    await run(
      'INSERT INTO otp_codes (user_id, code, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?)',
      [userIds['demo@montexto.com'], '123456', new Date(Date.now() + 5 * 60000).toISOString(), 0, new Date().toISOString()]
    );
    console.log('   OTP code 123456 cree pour demo@montexto.com (valide 5 min)');
  } else {
    console.log('   OTP code deja existant');
  }

  // ─── 16. Password reset token (pour test) ──────────────────────
  console.log('16. Password reset token...');
  const resetToken = crypto.randomBytes(16).toString('hex');
  await run(
    'INSERT INTO password_resets (user_id, token, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?)',
    [userIds['demo@montexto.com'], resetToken, new Date(Date.now() + 60 * 60000).toISOString(), 0, new Date().toISOString()]
  );
  console.log(`   Token de reset cree: ${resetToken}`);

  console.log('\n=== Donnees de test inserees avec succes ===');
  console.log('\nComptes de test:');
  console.log('  Super Admin:    admin@montexto.com / admin123');
  console.log('  Org Admin:      demo@montexto.com / demo123');
  console.log('  Resp Com:       resp.com@montexto.com / resp123');
  console.log('  Operateur:      operator@montexto.com / op123');
  console.log('  Auditeur:       auditor@montexto.com / audit123');
  console.log('  Admin BDM-SA:   admin.bdm@montexto.com / bdm123');
  console.log('  Com BDM-SA:     com.bdm@montexto.com / bdmcom123');
  console.log('  Admin Orange:   admin.orange@montexto.com / orange123');
  console.log('  Op CMDT:        op.cmdt@montexto.com / cmdt123');
  console.log(`\nToken reset demo: ${resetToken}`);
  db.close();
}

seedTestData().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
