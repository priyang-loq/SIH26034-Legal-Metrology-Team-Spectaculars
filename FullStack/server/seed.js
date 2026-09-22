require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const username = process.env.DEFAULT_AUTHORITY_USERNAME || 'authority_admin';
const password = process.env.DEFAULT_AUTHORITY_PASSWORD || 'ChangeMe123';
const name = process.env.DEFAULT_AUTHORITY_NAME || 'Senior Legal Metrology Inspector';

const existing = db.prepare('SELECT id FROM authority_users WHERE username = ?').get(username);

if (existing) {
  console.log(`Authority account "${username}" already exists. Skipping.`);
} else {
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO authority_users (id, username, passwordHash, name, designation, role)
    VALUES (?, ?, ?, ?, ?, 'AUTHORITY')
  `).run(uuidv4(), username, passwordHash, name, 'District Legal Metrology Officer');

  console.log('Demo authority account created:');
  console.log(`   username: ${username}`);
  console.log(`   password: ${password}`);
  console.log('Change this password before any real deployment.');
}
