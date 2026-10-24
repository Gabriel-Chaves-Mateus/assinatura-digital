const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

mongoose.set('strictQuery', true);

(async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB conectado');
  const server = app.listen(config.port, () => console.log(`API em :${config.port}`));
  const shutdown = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})().catch((err) => {
  console.error('Falha ao iniciar:', err.message);
  process.exit(1);
});
