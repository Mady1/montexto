require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const SYSTEM_ROLES = [
  { name: 'super_admin', display_name: 'Super Administrateur', description: 'Accès total à l\'application', is_system: 1 },
  { name: 'org_admin', display_name: 'Administrateur Organisation', description: 'Gère les utilisateurs et campagnes de son organisation', is_system: 1 },
  { name: 'resp_com', display_name: 'Responsable Communication', description: 'Crée et programme les campagnes SMS', is_system: 1 },
  { name: 'operator', display_name: 'Opérateur SMS', description: 'Envoie des SMS et gère les contacts', is_system: 1 },
  { name: 'auditor', display_name: 'Auditeur', description: 'Consultation uniquement, rapports et journaux', is_system: 1 },
];

const PERMISSIONS = [
  // Users
  { code: 'users.create', module: 'users', description: 'Créer utilisateur' },
  { code: 'users.edit', module: 'users', description: 'Modifier utilisateur' },
  { code: 'users.edit_self', module: 'users', description: 'Modifier son propre profil' },
  { code: 'users.delete', module: 'users', description: 'Supprimer utilisateur' },
  { code: 'users.view', module: 'users', description: 'Consulter utilisateur' },
  // Campaigns
  { code: 'campaigns.create', module: 'campaigns', description: 'Créer campagne' },
  { code: 'campaigns.edit', module: 'campaigns', description: 'Modifier campagne' },
  { code: 'campaigns.validate', module: 'campaigns', description: 'Valider campagne' },
  { code: 'campaigns.delete', module: 'campaigns', description: 'Supprimer campagne' },
  { code: 'campaigns.schedule', module: 'campaigns', description: 'Programmer campagne' },
  { code: 'campaigns.cancel', module: 'campaigns', description: 'Annuler campagne' },
  { code: 'campaigns.view', module: 'campaigns', description: 'Consulter campagne' },
  // Contacts
  { code: 'contacts.create', module: 'contacts', description: 'Créer contact' },
  { code: 'contacts.edit', module: 'contacts', description: 'Modifier contact' },
  { code: 'contacts.import', module: 'contacts', description: 'Importer contacts' },
  { code: 'contacts.delete', module: 'contacts', description: 'Supprimer contacts' },
  { code: 'contacts.view', module: 'contacts', description: 'Consulter contacts' },
  // SMS
  { code: 'sms.send', module: 'sms', description: 'Envoyer SMS' },
  { code: 'sms.send_bulk', module: 'sms', description: 'Envoyer SMS en masse' },
  { code: 'sms.history', module: 'sms', description: 'Consulter historique SMS' },
  { code: 'sms.delete', module: 'sms', description: 'Supprimer SMS' },
  // Administration
  { code: 'admin.system', module: 'admin', description: 'Paramétrage système' },
  { code: 'admin.api', module: 'admin', description: 'Gestion API' },
  { code: 'admin.credits', module: 'admin', description: 'Gestion crédits' },
  { code: 'admin.organizations', module: 'admin', description: 'Gestion des organisations' },
  { code: 'admin.gateways', module: 'admin', description: 'Gestion passerelles SMS' },
  // Reporting
  { code: 'reporting.view', module: 'reporting', description: 'Consulter statistiques' },
  { code: 'reporting.export_excel', module: 'reporting', description: 'Export Excel' },
  { code: 'reporting.export_pdf', module: 'reporting', description: 'Export PDF' },
  // Audit
  { code: 'audit.view', module: 'audit', description: 'Consulter journaux d\'audit' },
];

// Role → permission codes mapping
const ROLE_PERMISSIONS = {
  super_admin: '*', // all permissions
  org_admin: [
    'users.create', 'users.edit', 'users.delete', 'users.view',
    'campaigns.create', 'campaigns.edit', 'campaigns.validate', 'campaigns.delete', 'campaigns.schedule', 'campaigns.cancel', 'campaigns.view',
    'contacts.create', 'contacts.edit', 'contacts.import', 'contacts.delete', 'contacts.view',
    'sms.send', 'sms.send_bulk', 'sms.history', 'sms.delete',
    'admin.credits', 'admin.api',
    'reporting.view', 'reporting.export_excel', 'reporting.export_pdf',
  ],
  resp_com: [
    'campaigns.create', 'campaigns.edit', 'campaigns.schedule', 'campaigns.view',
    'contacts.create', 'contacts.edit', 'contacts.import', 'contacts.view',
    'sms.send', 'sms.send_bulk', 'sms.history', 'sms.delete',
    'reporting.view', 'reporting.export_excel',
  ],
  operator: [
    'campaigns.view',
    'contacts.create', 'contacts.edit', 'contacts.import', 'contacts.view',
    'sms.send', 'sms.history',
  ],
  auditor: [
    'campaigns.view',
    'contacts.view',
    'sms.history',
    'reporting.view', 'reporting.export_excel', 'reporting.export_pdf',
    'audit.view',
  ],
};

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

async function seed() {
  console.log('Seeding database...\n');

  // 1. Seed permissions
  console.log('1. Seeding permissions...');
  const permMap = {};
  for (const perm of PERMISSIONS) {
    const existing = await getOne('SELECT id FROM permissions WHERE code = ?', [perm.code]);
    if (existing) {
      permMap[perm.code] = existing.id;
    } else {
      const id = await run(
        'INSERT INTO permissions (code, module, description) VALUES (?, ?, ?)',
        [perm.code, perm.module, perm.description]
      );
      permMap[perm.code] = id;
    }
  }
  console.log(`   ${Object.keys(permMap).length} permissions ready`);

  // 2. Seed roles
  console.log('2. Seeding roles...');
  const roleMap = {};
  for (const role of SYSTEM_ROLES) {
    const existing = await getOne('SELECT id FROM roles WHERE name = ?', [role.name]);
    if (existing) {
      roleMap[role.name] = existing.id;
    } else {
      const id = await run(
        'INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?)',
        [role.name, role.display_name, role.description, role.is_system]
      );
      roleMap[role.name] = id;
    }
  }
  console.log(`   ${Object.keys(roleMap).length} roles ready`);

  // 3. Seed role-permission mappings
  console.log('3. Seeding role-permission mappings...');
  for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;

    // Clear existing mappings
    await run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    // Determine which permission IDs to insert
    let codesToInsert = permCodes;
    if (codesToInsert === '*') {
      codesToInsert = Object.keys(permMap);
    }

    for (const code of codesToInsert) {
      const permId = permMap[code];
      if (permId) {
        await run(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?) ON CONFLICT (role_id, permission_id) DO NOTHING',
          [roleId, permId]
        );
      }
    }
  }
  console.log('   Role-permission mappings ready');

  // 4. Create default organization
  console.log('4. Seeding default organization...');
  let org = await getOne("SELECT id FROM organizations WHERE name = 'Montexto Demo'");
  if (!org) {
    const orgId = await run(
      "INSERT INTO organizations (name, type, email, phone, address, sms_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['Montexto Demo', 'entreprise', 'contact@montexto.com', '+223 20 22 00 00', 'Bamako, Mali', 10000, 'active']
    );
    org = { id: orgId };
    console.log(`   Created organization: Montexto Demo (id=${org.id})`);
  } else {
    console.log(`   Organization already exists (id=${org.id})`);
  }

  // 5. Create super admin user
  console.log('5. Seeding super admin user...');
  const adminEmail = 'admin@montexto.com';
  const adminPassword = 'admin123';
  let admin = await getOne('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!admin) {
    const hashed = bcrypt.hashSync(adminPassword, 10);
    const userId = await run(
      'INSERT INTO users (email, password, first_name, last_name, phone, organization_id, role_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [adminEmail, hashed, 'Super', 'Admin', '+22300000000', org.id, roleMap['super_admin'], 'active']
    );
    console.log(`   Created super admin: ${adminEmail} / ${adminPassword}`);
    
    // Add some demo recharges
    await run('INSERT INTO recharges (user_id, organization_id, amount, payment_method, status) VALUES (?, ?, ?, ?, ?)',
      [userId, org.id, 50000, 'Manuel', 'success']);
  } else {
    // Ensure existing admin has the super_admin role
    await run('UPDATE users SET role_id = ?, organization_id = ? WHERE id = ?',
      [roleMap['super_admin'], org.id, admin.id]);
    console.log(`   Super admin already exists (id=${admin.id}), role updated`);
  }

  // 6. Create demo org_admin user
  console.log('6. Seeding demo org_admin user...');
  const demoEmail = 'demo@montexto.com';
  let demo = await getOne('SELECT id FROM users WHERE email = ?', [demoEmail]);
  if (!demo) {
    const hashed = bcrypt.hashSync('demo123', 10);
    const userId = await run(
      'INSERT INTO users (email, password, first_name, last_name, phone, organization_id, role_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [demoEmail, hashed, 'Demo', 'User', '+22370000000', org.id, roleMap['org_admin'], 'active']
    );
    console.log(`   Created demo user: ${demoEmail} / demo123`);
  } else {
    // Update existing demo user with role and org
    await run('UPDATE users SET role_id = ?, organization_id = ? WHERE id = ?',
      [roleMap['org_admin'], org.id, demo.id]);
    console.log(`   Demo user already exists, role updated to org_admin`);
  }

  console.log('\n=== Seed complete ===');
  console.log('Super Admin: admin@montexto.com / admin123');
  console.log('Demo User:   demo@montexto.com / demo123');
  db.close();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
