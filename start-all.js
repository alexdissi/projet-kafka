#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration des services
const services = [
  {
    name: 'Commande Service',
    command: 'node',
    args: ['services/commande/index.js'],
    color: '\x1b[32m', // Green
    port: 3001
  },
  {
    name: 'Suivi Service',
    command: 'node',
    args: ['services/suivi/index.js'],
    color: '\x1b[34m', // Blue
    port: 3002
  },
  {
    name: 'Analyseur Service',
    command: 'node',
    args: ['services/analyseur/index.js'],
    color: '\x1b[35m', // Magenta
    port: 3003
  },
  {
    name: 'Paiement Service',
    command: 'node',
    args: ['services/paiement/index.js'],
    color: '\x1b[33m', // Yellow
    port: 3004
  }
];

const reset = '\x1b[0m';
const processes = [];

// Fonction pour logger avec couleur
function log(service, message, isError = false) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = `[${timestamp}] ${service.color}[${service.name}]${reset}`;
  const color = isError ? '\x1b[31m' : service.color;
  console.log(`${prefix} ${color}${message}${reset}`);
}

// Fonction pour démarrer un service
function startService(service) {
  const child = spawn(service.command, service.args, {
    cwd: __dirname,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  // Gérer les logs stdout
  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        log(service, line);
      }
    });
  });

  // Gérer les logs stderr
  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        log(service, line, true);
      }
    });
  });

  // Gérer la fermeture du process
  child.on('close', (code) => {
    if (code === 0) {
      log(service, `✅ Process exited successfully`, false);
    } else {
      log(service, `❌ Process exited with code ${code}`, true);
    }
  });

  child.on('error', (error) => {
    log(service, `❌ Failed to start: ${error.message}`, true);
  });

  processes.push({ service, child });
  return child;
}

// Fonction pour arrêter tous les services
function stopAllServices() {
  console.log('\n🛑 Stopping all services...\n');
  
  processes.forEach(({ service, child }) => {
    log(service, '🛑 Stopping service...');
    child.kill('SIGTERM');
  });

  // Force kill after 5 seconds
  setTimeout(() => {
    processes.forEach(({ service, child }) => {
      if (!child.killed) {
        log(service, '💀 Force killing service...');
        child.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 5000);
}

// Gérer les signaux d'arrêt
process.on('SIGINT', stopAllServices);
process.on('SIGTERM', stopAllServices);

// Banner de démarrage
console.log(`
🚀 ================================
   KAFKA BANKING MICROSERVICES
   Starting all services...
================================

📍 Service Endpoints:
   • Commande:  http://localhost:3001
   • Suivi:     http://localhost:3002  
   • Analyseur: http://localhost:3003
   • Paiement:  http://localhost:3004

📊 Monitoring:
   • Grafana:    http://localhost:3000 (admin/admin)
   • Prometheus: http://localhost:9090

🔗 Test Command:
   curl -X POST http://localhost:3001/orders \\
     -H "Content-Type: application/json" \\
     -d '{"userId":"user123","amount":100.50,"items":["item1"]}'

Press Ctrl+C to stop all services
================================
`);

// Démarrer tous les services
services.forEach(service => {
  log(service, `🚀 Starting service on port ${service.port}...`);
  startService(service);
});

console.log(`\n✅ All services started! Check the logs above for details.\n`);