#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.cyan) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkPrerequisites() {
  console.log(`
🎬 ===============================================
   DÉMO KAFKA - VÉRIFICATION DES PRÉREQUIS
===============================================
`);

  const checks = [];

  // Vérifier Node.js
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
      checks.push({ name: 'Node.js', status: 'OK', detail: version, color: colors.green });
    } else {
      checks.push({ name: 'Node.js', status: 'WARN', detail: `${version} (recommandé: 18+)`, color: colors.yellow });
    }
  } catch (error) {
    checks.push({ name: 'Node.js', status: 'ERROR', detail: 'Non installé', color: colors.red });
  }

  // Vérifier Docker
  try {
    const { stdout } = await execAsync('docker --version');
    checks.push({ name: 'Docker', status: 'OK', detail: stdout.trim(), color: colors.green });
  } catch (error) {
    checks.push({ name: 'Docker', status: 'ERROR', detail: 'Non installé ou non démarré', color: colors.red });
  }

  // Vérifier les ports
  const ports = [3000, 3001, 3002, 3003, 3004, 9090, 9092];
  const portResults = [];

  for (const port of ports) {
    try {
      await execAsync(`lsof -i :${port}`);
      portResults.push({ port, status: 'OCCUPÉ', color: colors.yellow });
    } catch (error) {
      portResults.push({ port, status: 'LIBRE', color: colors.green });
    }
  }

  // Vérifier curl
  try {
    await execAsync('curl --version');
    checks.push({ name: 'curl', status: 'OK', detail: 'Disponible', color: colors.green });
  } catch (error) {
    checks.push({ name: 'curl', status: 'WARN', detail: 'Non installé (optionnel)', color: colors.yellow });
  }

  // Afficher les résultats
  console.log('📋 VÉRIFICATION DES COMPOSANTS:');
  checks.forEach(check => {
    const status = check.status.padEnd(5);
    log(`   ${check.name.padEnd(10)} [${status}] ${check.detail}`, check.color);
  });

  console.log('\n🔌 VÉRIFICATION DES PORTS:');
  portResults.forEach(result => {
    const status = result.status.padEnd(6);
    log(`   Port ${result.port.toString().padEnd(4)} [${status}]`, result.color);
  });

  // Recommandations
  console.log('\n💡 RECOMMANDATIONS POUR LA DÉMO:');
  
  const hasErrors = checks.some(c => c.status === 'ERROR');
  const hasOccupiedPorts = portResults.some(p => p.status === 'OCCUPÉ');

  if (hasErrors) {
    log('   ❌ Corriger les erreurs critiques avant la démo', colors.red);
  }

  if (hasOccupiedPorts) {
    log('   ⚠️  Certains ports sont occupés. Si ce sont vos services, c\'est normal.', colors.yellow);
    log('      Sinon, libérer les ports ou redémarrer les services existants.', colors.yellow);
  }

  if (!hasErrors && !hasOccupiedPorts) {
    log('   ✅ Système prêt pour la démonstration !', colors.green);
  }

  console.log(`
🎯 ÉTAPES DE DÉMO RECOMMANDÉES:
   1. Ouvrir les onglets navigateur AVANT de commencer
   2. Terminal avec police lisible (14pt minimum)
   3. npm start (démarrage complet)
   4. Attendre que tous les services soient verts
   5. npm run demo (test de charge)
   6. Montrer Grafana en temps réel

📝 URLs à ouvrir dans le navigateur:
   • Grafana:    http://localhost:3000 (admin/admin)
   • Prometheus: http://localhost:9090
   • Services:   http://localhost:3001-3004

🚀 Commande de démarrage: npm start
📊 Test de charge:       npm run demo

===============================================
Bonne démonstration ! 🎉
`);
}

checkPrerequisites().catch(error => {
  log(`❌ Erreur lors de la vérification: ${error.message}`, colors.red);
  process.exit(1);
});