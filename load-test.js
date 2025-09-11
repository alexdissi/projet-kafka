#!/usr/bin/env node

import { setTimeout } from 'timers/promises';

// Configuration du test de charge
const CONFIG = {
  baseUrl: 'http://localhost:3001',
  duration: 120, // Durée en secondes
  rampUpTime: 30, // Temps de montée en charge (secondes)
  maxConcurrentUsers: 20,
  minDelay: 100, // Délai minimum entre requêtes (ms)
  maxDelay: 2000, // Délai maximum entre requêtes (ms)
  showProgress: true
};

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Statistiques globales
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  startTime: Date.now(),
  requestTimes: [],
  errors: new Map()
};

// Données de test variées
const testUsers = [
  'alice123', 'bob456', 'charlie789', 'diana101', 'edward202',
  'fiona303', 'george404', 'helen505', 'ivan606', 'julia707'
];

const testItems = [
  ['laptop', 'mouse'], ['phone', 'case', 'charger'], ['book', 'bookmark'],
  ['coffee', 'mug'], ['headphones'], ['tablet', 'stylus'], ['watch', 'band'],
  ['camera', 'lens', 'tripod'], ['keyboard', 'mousepad'], ['speaker']
];

function log(message, color = colors.cyan) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logSuccess(message) { log(`✅ ${message}`, colors.green); }
function logError(message) { log(`❌ ${message}`, colors.red); }
function logInfo(message) { log(`ℹ️ ${message}`, colors.blue); }
function logWarning(message) { log(`⚠️ ${message}`, colors.yellow); }

// Générer une commande aléatoire
function generateRandomOrder() {
  const userId = testUsers[Math.floor(Math.random() * testUsers.length)];
  const items = testItems[Math.floor(Math.random() * testItems.length)];
  const amount = parseFloat((Math.random() * 500 + 10).toFixed(2)); // Entre 10 et 510 euros
  
  return {
    userId,
    amount,
    items
  };
}

// Envoyer une requête
async function sendOrder(orderData, userId = 'unknown') {
  const startTime = Date.now();
  stats.totalRequests++;

  try {
    const response = await fetch(`${CONFIG.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });

    const responseTime = Date.now() - startTime;
    stats.requestTimes.push(responseTime);

    if (response.ok) {
      stats.successfulRequests++;
      const result = await response.json();
      log(`📦 Order ${result.orderId} created by ${orderData.userId} (${orderData.amount}€) - ${responseTime}ms`, colors.green);
      return true;
    } else {
      stats.failedRequests++;
      const error = await response.text();
      logError(`Failed to create order for ${orderData.userId}: ${response.status} ${error}`);
      
      const errorKey = `${response.status}`;
      stats.errors.set(errorKey, (stats.errors.get(errorKey) || 0) + 1);
      return false;
    }
  } catch (error) {
    stats.failedRequests++;
    const responseTime = Date.now() - startTime;
    logError(`Network error for ${orderData.userId}: ${error.message} - ${responseTime}ms`);
    
    const errorKey = error.message;
    stats.errors.set(errorKey, (stats.errors.get(errorKey) || 0) + 1);
    return false;
  }
}

// Simuler un utilisateur
async function simulateUser(userId, duration) {
  const endTime = Date.now() + duration * 1000;
  let requestCount = 0;

  log(`👤 User ${userId} started simulation`, colors.magenta);

  while (Date.now() < endTime) {
    const order = generateRandomOrder();
    await sendOrder(order, userId);
    requestCount++;

    // Délai aléatoire entre les requêtes
    const delay = Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay)) + CONFIG.minDelay;
    await setTimeout(delay);
  }

  log(`👤 User ${userId} finished - ${requestCount} requests sent`, colors.magenta);
}

// Afficher les statistiques en temps réel
function displayStats() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rps = (stats.totalRequests / elapsed).toFixed(2);
  const avgResponseTime = stats.requestTimes.length > 0 
    ? (stats.requestTimes.reduce((a, b) => a + b, 0) / stats.requestTimes.length).toFixed(2)
    : 0;
  
  const p95ResponseTime = stats.requestTimes.length > 0
    ? stats.requestTimes.sort((a, b) => a - b)[Math.floor(stats.requestTimes.length * 0.95)]
    : 0;

  console.clear();
  console.log(`
🚀 ================================================
   KAFKA BANKING SYSTEM - LOAD TEST
================================================

⏱️  Time Elapsed: ${elapsed.toFixed(1)}s / ${CONFIG.duration}s
📊 Total Requests: ${stats.totalRequests}
✅ Successful: ${stats.successfulRequests} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%)
❌ Failed: ${stats.failedRequests}
🔄 Rate: ${rps} req/s
📈 Avg Response Time: ${avgResponseTime}ms
📈 95th Percentile: ${p95ResponseTime}ms

🎯 Monitoring URLs:
   • Grafana:    http://localhost:3000
   • Prometheus: http://localhost:9090
   • Orders API: http://localhost:3001
   • Status API: http://localhost:3002

Press Ctrl+C to stop the load test
================================================
`);

  if (stats.errors.size > 0) {
    console.log('🔴 Errors:');
    for (const [error, count] of stats.errors.entries()) {
      console.log(`   ${error}: ${count}`);
    }
    console.log('');
  }
}

// Montée en charge progressive
async function rampUp() {
  logInfo(`Starting ramp-up phase: 0 → ${CONFIG.maxConcurrentUsers} users over ${CONFIG.rampUpTime}s`);
  
  const users = [];
  const userInterval = (CONFIG.rampUpTime * 1000) / CONFIG.maxConcurrentUsers;
  
  for (let i = 0; i < CONFIG.maxConcurrentUsers; i++) {
    const userId = `user-${i + 1}`;
    const remainingTime = CONFIG.duration - (CONFIG.rampUpTime * (i / CONFIG.maxConcurrentUsers));
    
    // Démarrer l'utilisateur
    users.push(simulateUser(userId, remainingTime));
    
    logInfo(`Started user ${i + 1}/${CONFIG.maxConcurrentUsers}`);
    
    if (i < CONFIG.maxConcurrentUsers - 1) {
      await setTimeout(userInterval);
    }
  }
  
  logSuccess('Ramp-up phase completed! All users are active');
  return users;
}

// Test de charge principal
async function runLoadTest() {
  logInfo('🚀 Starting Kafka Banking System Load Test');
  logInfo(`Configuration: ${CONFIG.maxConcurrentUsers} users, ${CONFIG.duration}s duration`);
  
  // Vérifier la connectivité
  try {
    const response = await fetch(`${CONFIG.baseUrl}/`);
    if (!response.ok) throw new Error(`Service not ready: ${response.status}`);
    logSuccess('Service connectivity verified');
  } catch (error) {
    logError(`Cannot connect to service: ${error.message}`);
    logError('Make sure the microservices are running with: npm run start:all');
    process.exit(1);
  }

  // Démarrer l'affichage des statistiques
  const statsInterval = CONFIG.showProgress ? setInterval(displayStats, 2000) : null;

  try {
    // Phase de montée en charge
    const users = await rampUp();
    
    // Attendre que tous les utilisateurs terminent
    await Promise.all(users);
    
  } finally {
    if (statsInterval) clearInterval(statsInterval);
  }

  // Statistiques finales
  const totalTime = (Date.now() - stats.startTime) / 1000;
  console.clear();
  console.log(`
🏁 ================================================
   LOAD TEST COMPLETED
================================================

⏱️  Total Duration: ${totalTime.toFixed(1)}s
📊 Total Requests: ${stats.totalRequests}
✅ Successful: ${stats.successfulRequests} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%)
❌ Failed: ${stats.failedRequests}
🔄 Average Rate: ${(stats.totalRequests / totalTime).toFixed(2)} req/s

📈 Response Times:
   • Average: ${(stats.requestTimes.reduce((a, b) => a + b, 0) / stats.requestTimes.length).toFixed(2)}ms
   • Min: ${Math.min(...stats.requestTimes)}ms
   • Max: ${Math.max(...stats.requestTimes)}ms
   • 95th Percentile: ${stats.requestTimes.sort((a, b) => a - b)[Math.floor(stats.requestTimes.length * 0.95)]}ms

🎯 Next Steps:
   1. Check Grafana dashboards: http://localhost:3000
   2. Verify metrics in Prometheus: http://localhost:9090
   3. Check order statuses: http://localhost:3002/orders
   4. View statistics: http://localhost:3003/statistics

================================================
`);

  if (stats.errors.size > 0) {
    console.log('🔴 Error Summary:');
    for (const [error, count] of stats.errors.entries()) {
      console.log(`   ${error}: ${count} occurrences`);
    }
  }
}

// Gérer l'arrêt propre
process.on('SIGINT', () => {
  logWarning('Load test interrupted by user');
  process.exit(0);
});

// Lancer le test
runLoadTest().catch(error => {
  logError(`Load test failed: ${error.message}`);
  process.exit(1);
});