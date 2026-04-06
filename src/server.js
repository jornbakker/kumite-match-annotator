const express = require('express');
const path = require('path');

const { initDb } = require('./db');
const { registerRoutes } = require('./routes');

const PORT = process.env.PORT || 3000;

async function start() {
  await initDb();

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  registerRoutes(app);

  app.listen(PORT, () => {
    console.log(`Kumite annotation app running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
