#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = colors.cyan) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

// Fonction pour attendre
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Vérifier si Docker est disponible
async function checkDocker() {
  try {
    await execAsync('docker --version');
    logSuccess('Docker is available');
    return true;
  } catch (error) {
    logError('Docker is not available or not running');
    return false;
  }
}

// Vérifier si les conteneurs sont déjà en cours d'exécution
async function checkContainers() {
  try {
    const { stdout } = await execAsync('docker compose ps --services --filter "status=running"');
    return stdout.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

// Démarrer l'infrastructure Docker
async function startInfrastructure() {
  logInfo('Starting Docker infrastructure...');
  
  try {
    // Vérifier si des conteneurs sont déjà en cours d'exécution
    const runningContainers = await checkContainers();
    if (runningContainers.length > 0) {
      logInfo(`Found running containers: ${runningContainers.join(', ')}`);
      logWarning('Some containers are already running. Stopping them first...');
      await execAsync('npm run monitoring:down');
      await sleep(3000);
    }

    // Démarrer l'infrastructure
    logInfo('Starting Kafka + Monitoring stack...');
    try {
      await execAsync('npm run monitoring:up');
    } catch (error) {
      logWarning('Failed to start full monitoring stack, trying simple version...');
      await execAsync('npm run monitoring:simple');
      logInfo('Started with simplified monitoring (without JMX Exporter)');
    }
    
    logSuccess('Docker infrastructure started');
    return true;
  } catch (error) {
    logError(`Failed to start infrastructure: ${error.message}`);
    return false;
  }
}

// Attendre que les services soient prêts
async function waitForServices() {
  logInfo('Waiting for services to be ready...');
  
  const services = [
    { name: 'Kafka', url: 'http://localhost:9092', maxRetries: 30 },
    { name: 'Prometheus', url: 'http://localhost:9090', maxRetries: 20 },
    { name: 'Grafana', url: 'http://localhost:3000', maxRetries: 20 }
  ];

  for (const service of services) {
    logInfo(`Waiting for ${service.name}...`);
    let retries = 0;
    
    while (retries < service.maxRetries) {
      try {
        if (service.name === 'Kafka') {
          // Pour Kafka, on teste avec une commande docker
          await execAsync('docker exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list');
        } else {
          // Pour les autres services HTTP
          await execAsync(`curl -s -f ${service.url} > /dev/null`);
        }
        logSuccess(`${service.name} is ready`);
        break;
      } catch (error) {
        retries++;
        if (retries < service.maxRetries) {
          await sleep(2000);
        } else {
          logWarning(`${service.name} not ready after ${service.maxRetries} attempts, continuing anyway...`);
        }
      }
    }
  }
}

// Créer les topics Kafka
async function createTopics() {
  logInfo('Creating Kafka topics...');
  try {
    await execAsync('npm run topics');
    logSuccess('Kafka topics created');
    return true;
  } catch (error) {
    logError(`Failed to create topics: ${error.message}`);
    return false;
  }
}

// Démarrer les microservices
async function startMicroservices() {
  logInfo('Starting microservices...');
  
  const microservicesProcess = spawn('node', ['start-all.js'], {
    stdio: 'inherit'
  });

  // Gérer l'arrêt propre
  process.on('SIGINT', () => {
    logInfo('Shutting down microservices...');
    microservicesProcess.kill('SIGTERM');
  });

  process.on('SIGTERM', () => {
    logInfo('Shutting down microservices...');
    microservicesProcess.kill('SIGTERM');
  });

  return microservicesProcess;
}

// Fonction principale
async function main() {
  console.log(`
🚀 ================================================
   KAFKA BANKING SYSTEM - COMPLETE STARTUP
================================================

This script will:
1. 🐳 Start Docker infrastructure (Kafka, Prometheus, Grafana)
2. ⏳ Wait for all services to be ready
3. 📝 Create Kafka topics
4. 🔄 Start all microservices

Press Ctrl+C at any time to stop everything.
================================================
`);

  try {
    // 1. Vérifier Docker
    if (!(await checkDocker())) {
      process.exit(1);
    }

    // 2. Démarrer l'infrastructure
    if (!(await startInfrastructure())) {
      process.exit(1);
    }

    // 3. Attendre que les services soient prêts
    await waitForServices();

    // 4. Créer les topics
    if (!(await createTopics())) {
      logWarning('Topics creation failed, but continuing...');
    }

    // 5. Petite pause avant de démarrer les microservices
    logInfo('Starting microservices in 3 seconds...');
    await sleep(3000);

    // 6. Démarrer les microservices
    const microservicesProcess = await startMicroservices();
    
    // Attendre que le processus des microservices se termine
    microservicesProcess.on('close', (code) => {
      logInfo(`Microservices process exited with code ${code}`);
      process.exit(code);
    });

  } catch (error) {
    logError(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

// Démarrer le script
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});