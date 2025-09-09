import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createConsumer } from '../shared/kafka.js';

const app = new Hono();
const consumer = createConsumer('suivi-svc');

// Store en mémoire pour l'agrégation des événements
const orderStatuses = new Map(); // orderId -> { status, events[], lastUpdated }

app.get('/', (c) => {
  return c.text('Suivi Service API - Ready');
});

// GET /orders/{id}/status - Endpoint d'agrégation
app.get('/orders/:orderId/status', (c) => {
  const orderId = c.req.param('orderId');
  
  const orderInfo = orderStatuses.get(orderId);
  
  if (!orderInfo) {
    return c.json({ 
      error: 'Order not found',
      orderId 
    }, 404);
  }

  // Déterminer le statut final basé sur les événements
  let finalStatus = 'UNKNOWN';
  let details = {};

  const events = orderInfo.events.sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  for (const event of events) {
    switch (event.type) {
      case 'OrderCreated':
        finalStatus = 'CREATED';
        details = {
          userId: event.data.userId,
          amount: event.data.amount,
          items: event.data.items,
          createdAt: event.data.createdAt
        };
        break;
      case 'PaymentAuthorized':
        finalStatus = 'PAYMENT_AUTHORIZED';
        details.paymentStatus = 'AUTHORIZED';
        details.authorizationCode = event.data.authorizationCode;
        details.authorizedAt = event.data.processedAt;
        break;
      case 'PaymentRejected':
        finalStatus = 'PAYMENT_REJECTED';
        details.paymentStatus = 'REJECTED';
        details.rejectionReason = event.data.rejectionReason;
        details.rejectedAt = event.data.processedAt;
        break;
    }
  }

  return c.json({
    orderId,
    status: finalStatus,
    details,
    events: events.map(e => ({
      type: e.type,
      timestamp: e.timestamp,
      eventId: e.eventId
    })),
    lastUpdated: orderInfo.lastUpdated
  });
});

// GET /orders - Liste tous les ordres
app.get('/orders', (c) => {
  const orders = Array.from(orderStatuses.entries()).map(([orderId, info]) => ({
    orderId,
    status: info.status,
    eventCount: info.events.length,
    lastUpdated: info.lastUpdated
  }));

  return c.json({
    orders,
    totalCount: orders.length
  });
});

async function startService() {
  try {
    console.log('🚀 Starting Suivi Service...');
    
    await consumer.connect();
    console.log('✅ Connected to Kafka');

    // Subscribe to all order-related events
    await consumer.subscribe({ 
      topics: [
        'orders.created', 
        'payments.authorized', 
        'payments.rejected'
      ] 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const eventData = JSON.parse(message.value.toString());
          const { orderId } = eventData;
          const eventId = message.headers?.eventId?.toString() || 'unknown';
          
          console.log(`📥 suivi ⬅ consumed: ${topic} for ${orderId} (partition ${partition})`);

          // Initialiser l'entrée si elle n'existe pas
          if (!orderStatuses.has(orderId)) {
            orderStatuses.set(orderId, {
              status: 'UNKNOWN',
              events: [],
              lastUpdated: new Date().toISOString()
            });
          }

          const orderInfo = orderStatuses.get(orderId);
          
          // Déterminer le type d'événement
          let eventType;
          switch (topic) {
            case 'orders.created':
              eventType = 'OrderCreated';
              orderInfo.status = 'CREATED';
              break;
            case 'payments.authorized':
              eventType = 'PaymentAuthorized';
              orderInfo.status = 'PAYMENT_AUTHORIZED';
              break;
            case 'payments.rejected':
              eventType = 'PaymentRejected';
              orderInfo.status = 'PAYMENT_REJECTED';
              break;
            default:
              eventType = 'Unknown';
          }

          // Éviter les doublons d'événements (déduplication)
          const existingEvent = orderInfo.events.find(e => e.eventId === eventId);
          if (!existingEvent) {
            orderInfo.events.push({
              type: eventType,
              eventId,
              timestamp: new Date().toISOString(),
              data: eventData
            });
            orderInfo.lastUpdated = new Date().toISOString();
            
            console.log(`📊 suivi → aggregated: ${eventType} for ${orderId} (total events: ${orderInfo.events.length})`);
          } else {
            console.log(`⚠️ suivi → duplicate event ignored: ${eventId}`);
          }

        } catch (error) {
          console.error('❌ Error processing suivi message:', error.message);
        }
      }
    });

    // Démarrer le serveur HTTP
    serve({
      fetch: app.fetch,
      port: 3002
    });

    console.log('🌐 HTTP server running on http://localhost:3002');
    console.log('📊 Aggregating order events for status tracking...');

  } catch (error) {
    console.error('❌ Error starting Suivi Service:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down Suivi Service...');
  
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