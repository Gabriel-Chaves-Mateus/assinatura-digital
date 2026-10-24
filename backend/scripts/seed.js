// Cria o primeiro gerente (e um funcionário de exemplo). Uso: npm run seed
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const User = require('../src/models/User');

(async () => {
  await mongoose.connect(config.mongoUri);
  const managerPass = process.env.SEED_MANAGER_PASSWORD;
  if (!managerPass || managerPass.length < 10) {
    throw new Error('Defina SEED_MANAGER_PASSWORD (mín. 10 caracteres)');
  }
  const users = [
    { name: 'Gerente Demo', email: process.env.SEED_MANAGER_EMAIL || 'gerente@exemplo.com', role: 'manager', department: 'Financeiro', position: 'Gerente', pass: managerPass },
  ];
  if (process.env.SEED_EMPLOYEE_PASSWORD) {
    users.push({ name: 'Funcionário Demo', email: 'funcionario@exemplo.com', role: 'employee', department: 'Vendas', position: 'Analista', pass: process.env.SEED_EMPLOYEE_PASSWORD });
  }
  for (const { pass, ...u } of users) {
    const exists = await User.exists({ email: u.email });
    if (exists) { console.log('já existe:', u.email); continue; }
    await User.create({ ...u, passwordHash: await bcrypt.hash(pass, 12) });
    console.log('criado:', u.email);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
