import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createConsumer, createProducer } from '../shared/kafka.js';
import { sendToDLQ, disconnectDLQ } from '../shared/dlq.js';
import { EventDeduplicator, withRetry } from '../shared/resilience.js';
import { createMetricsMiddleware, createMetricsRoute, kafkaMessagesProduced, kafkaMessagesConsumed, paymentsTotal, createKafkaTimer } from '../shared/metrics.js';

const app = new Hono();
const consumer = createConsumer('paiement-svc');
const producer = createProducer();
const deduplicator = new EventDeduplicator();

// Ajouter middleware de métriques
app.use('*', createMetricsMiddleware('paiement'));

// Ajouter route pour exposer les métriques Prometheus
createMetricsRoute(app, 'paiement');

app.get('/', (c) => {
  return c.text('Paiement Service API - Ready');
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'paiement', timestamp: new Date().toISOString() });
});

// Simule la logique métier de paiement
function processPayment(orderData) {
  // Simule 20% de rejets pour démonstration
  const isAuthorized = Math.random() > 0.2;
  
  if (isAuthorized) {
    return {
      status: 'AUTHORIZED',
      authorizationCode: `AUTH-${Date.now()}`,
      processedAt: new Date().toISOString()
    };
  } else {
    return {
      status: 'REJECTED',
      rejectionReason: 'Insufficient funds',
      processedAt: new Date().toISOString()
    };
  }
}

async function startService() {
  try {
    console.log('🚀 Starting Paiement Service...');
    
    await consumer.connect();
    await producer.connect();
    console.log('✅ Connected to Kafka');

    // Démarrer le serveur HTTP pour les métriques
    serve({
      fetch: app.fetch,
      port: 3004
    });
    
    console.log('🌐 HTTP server running on http://localhost:3004 (metrics at /metrics)');

    // Subscribe to OrderCreated events
    await consumer.subscribe({ topics: ['orders.created'] });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const MAX_RETRIES = 3;
        let shouldCommit = true;
        const endTimer = createKafkaTimer(topic, 'paiement');

        try {
          const eventId = message.headers?.eventId?.toString();
          const retryCount = parseInt(message.headers?.retryCount?.toString() || '0');
          
          // Vérifier si c'est un message poison (trop de retries)
          if (retryCount >= MAX_RETRIES) {
            console.log(`💀 Poison message detected: ${eventId} (${retryCount} retries)`);
            await sendToDLQ(message, new Error('Max retries exceeded'), 'paiement-svc', 'payments.dlq');
            return; // Message envoyé en DLQ, on peut commit
          }

          // Déduplication par eventId avec cache TTL
          if (deduplicator.isDuplicate(eventId)) {
            console.log(`⚠️ Duplicate event ignored: ${eventId}`);
            return;
          }

          const orderData = JSON.parse(message.value.toString());
          const { orderId } = orderData;

          // Simuler occasionnellement des erreurs pour tester DLQ
          if (Math.random() < 0.05) { // 5% d'erreurs simulées
            throw new Error('Simulated payment processing error');
          }

          console.log(`📥 paiement ⬅ consumed OrderCreated: ${orderId} from ${topic} (partition ${partition}) [retry: ${retryCount}] [cache: ${deduplicator.size()}]`);
          
          // Métriques de consommation
          kafkaMessagesConsumed.inc({ topic, service: 'paiement' });

          // Simulation du traitement avec délai
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Traitement du paiement
          const paymentResult = processPayment(orderData);
          
          const paymentEvent = {
            eventId: `payment-${orderId}-${Date.now()}`,
            orderId,
            userId: orderData.userId,
            amount: orderData.amount,
            ...paymentResult
          };

          // Publier PaymentAuthorized ou PaymentRejected
          const targetTopic = paymentResult.status === 'AUTHORIZED' 
            ? 'payments.authorized' 
            : 'payments.rejected';

          await producer.send({
            topic: targetTopic,
            messages: [{
              key: orderId, // Même clé pour partitioning cohérent
              value: JSON.stringify(paymentEvent),
              headers: {
                eventId: paymentEvent.eventId,
                eventType: paymentResult.status === 'AUTHORIZED' ? 'PaymentAuthorized' : 'PaymentRejected',
                originalEventId: eventId || 'unknown'
              }
            }]
          });

          console.log(`📤 paiement → produced: ${paymentResult.status} for ${orderId} to ${targetTopic}`);
          
          // Métriques de production et métier
          kafkaMessagesProduced.inc({ topic: targetTopic, service: 'paiement' });
          paymentsTotal.inc({ status: paymentResult.status.toLowerCase(), service: 'paiement' });
          
          endTimer(); // Fin du timer pour le processing

        } catch (error) {
          console.error('❌ Error processing payment message:', error.message);
          endTimer(); // Fin du timer même en cas d'erreur
          
          const retryCount = parseInt(message.headers?.retryCount?.toString() || '0');
          
          if (retryCount < MAX_RETRIES) {
            // Incrémenter le retry count et laisser Kafka faire un retry
            console.log(`🔄 Retrying message (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            shouldCommit = false; // Ne pas commit, laisser Kafka retry
            throw error; // Re-throw pour déclencher le retry
          } else {
            // Max retries atteint, envoyer en DLQ
            console.log(`💀 Max retries reached, sending to DLQ`);
            await sendToDLQ(message, error, 'paiement-svc', 'payments.dlq');
            shouldCommit = true; // Commit après DLQ
          }
        }

        // Commit explicite après traitement réussi
        if (shouldCommit) {
          // Le commit automatique est géré par KafkaJS, mais on pourrait faire un commit explicite ici si nécessaire
        }
      }
    });

  } catch (error) {
    console.error('❌ Error starting Paiement Service:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down Paiement Service...');
  
  try {
    await consumer.disconnect();
    await producer.disconnect();
    await disconnectDLQ();
    console.log('✅ Kafka disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting from Kafka:', error.message);
  }
  
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startService();