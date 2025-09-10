import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createConsumer } from '../shared/kafka.js';
import { createMetricsMiddleware, createMetricsRoute, kafkaMessagesConsumed, createKafkaTimer } from '../shared/metrics.js';

const app = new Hono();
const consumer = createConsumer('analyseur-svc');

// Ajouter middleware de métriques
app.use('*', createMetricsMiddleware('analyseur'));

// Ajouter route pour exposer les métriques Prometheus
createMetricsRoute(app, 'analyseur');

// Stockage des statistiques en mémoire
const statistics = {
  totalTransactions: 0,
  totalAmount: 0,
  authorizedTransactions: 0,
  rejectedTransactions: 0,
  averageAmount: 0,
  lastHourTransactions: [],
  startTime: new Date().toISOString()
};

app.get('/', (c) => {
  return c.text('Analyseur Service API - Ready');
});

// API pour récupérer les statistiques
app.get('/statistics', (c) => {
  // Calculer les stats de la dernière heure
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentTransactions = statistics.lastHourTransactions.filter(
    t => new Date(t.timestamp) > oneHourAgo
  );

  // Nettoyer les anciennes transactions
  statistics.lastHourTransactions = recentTransactions;

  const stats = {
    ...statistics,
    averageAmount: statistics.totalTransactions > 0 
      ? (statistics.totalAmount / statistics.totalTransactions).toFixed(2) 
      : 0,
    authorizationRate: statistics.totalTransactions > 0 
      ? ((statistics.authorizedTransactions / statistics.totalTransactions) * 100).toFixed(2) + '%'
      : '0%',
    lastHourCount: recentTransactions.length,
    lastHourAmount: recentTransactions.reduce((sum, t) => sum + t.amount, 0),
    uptime: calculateUptime(),
    timestamp: new Date().toISOString()
  };

  return c.json(stats);
});

// API pour récupérer les transactions de la dernière heure
app.get('/recent-transactions', (c) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentTransactions = statistics.lastHourTransactions
    .filter(t => new Date(t.timestamp) > oneHourAgo)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return c.json({
    transactions: recentTransactions,
    count: recentTransactions.length
  });
});

function calculateUptime() {
  const start = new Date(statistics.startTime);
  const now = new Date();
  const uptimeMs = now - start;
  
  const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
  
  return `${hours}h ${minutes}m ${seconds}s`;
}

async function startService() {
  try {
    console.log('🚀 Starting Analyseur Service...');
    
    await consumer.connect();
    console.log('✅ Connected to Kafka');

    // Subscribe to all transaction events
    await consumer.subscribe({ 
      topics: [
        'orders.created',
        'payments.authorized', 
        'payments.rejected'
      ] 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const endTimer = createKafkaTimer(topic, 'analyseur');
        
        try {
          const eventData = JSON.parse(message.value.toString());
          const timestamp = new Date().toISOString();
          
          console.log(`📥 analyseur ⬅ consumed: ${topic} (partition ${partition})`);
          
          // Métriques de consommation
          kafkaMessagesConsumed.inc({ topic, service: 'analyseur' });

          switch (topic) {
            case 'orders.created':
              statistics.totalTransactions++;
              statistics.totalAmount += eventData.amount;
              
              // Stocker pour les stats de la dernière heure
              statistics.lastHourTransactions.push({
                orderId: eventData.orderId,
                amount: eventData.amount,
                userId: eventData.userId,
                type: 'ORDER_CREATED',
                timestamp
              });
              
              console.log(`📊 analyseur → processed OrderCreated: total=${statistics.totalTransactions}, amount=${eventData.amount}`);
              break;

            case 'payments.authorized':
              statistics.authorizedTransactions++;
              
              // Mettre à jour la transaction dans l'historique
              const authTransaction = statistics.lastHourTransactions.find(
                t => t.orderId === eventData.orderId
              );
              if (authTransaction) {
                authTransaction.paymentStatus = 'AUTHORIZED';
                authTransaction.authorizationCode = eventData.authorizationCode;
              }
              
              console.log(`📊 analyseur → processed PaymentAuthorized: authorized=${statistics.authorizedTransactions}`);
              break;

            case 'payments.rejected':
              statistics.rejectedTransactions++;
              
              // Mettre à jour la transaction dans l'historique
              const rejTransaction = statistics.lastHourTransactions.find(
                t => t.orderId === eventData.orderId
              );
              if (rejTransaction) {
                rejTransaction.paymentStatus = 'REJECTED';
                rejTransaction.rejectionReason = eventData.rejectionReason;
              }
              
              console.log(`📊 analyseur → processed PaymentRejected: rejected=${statistics.rejectedTransactions}`);
              break;
          }

          // Log des statistiques périodiques
          if (statistics.totalTransactions % 10 === 0) {
            console.log(`📈 Stats: Total=${statistics.totalTransactions}, Auth=${statistics.authorizedTransactions}, Rej=${statistics.rejectedTransactions}, Avg=${(statistics.totalAmount / statistics.totalTransactions).toFixed(2)}`);
          }

          endTimer(); // Fin du timer pour le processing

        } catch (error) {
          console.error('❌ Error processing analyseur message:', error.message);
          endTimer(); // Fin du timer même en cas d'erreur
        }
      }
    });

    // Démarrer le serveur HTTP
    serve({
      fetch: app.fetch,
      port: 3003
    });

    console.log('🌐 HTTP server running on http://localhost:3003');
    console.log('📊 Ready to analyze transaction statistics...');

  } catch (error) {
    console.error('❌ Error starting Analyseur Service:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down Analyseur Service...');
  
  try {
    await consumer.disconnect();
    console.log('✅ Kafka disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting from Kafka:', error.message);
  }
  
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startService();