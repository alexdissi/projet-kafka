import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createProducer } from '../shared/kafka.js';
import { EventDeduplicator, withRetry, ExponentialBackoff } from '../shared/resilience.js';
import { createMetricsMiddleware, createMetricsRoute, kafkaMessagesProduced, ordersTotal, orderAmount } from '../shared/metrics.js';

const app = new Hono();
const producer = createProducer();

// Ajouter middleware de métriques
app.use('*', createMetricsMiddleware('commande'));

// Ajouter route pour exposer les métriques Prometheus
createMetricsRoute(app, 'commande');

let orderCounter = 1;
const deduplicator = new EventDeduplicator();
const backoff = new ExponentialBackoff();

app.get('/', (c) => {
  return c.text('Commande Service API - Ready');
});

// REST POST /orders qui publie OrderCreated
app.post('/orders', async (c) => {
  try {
    const body = await c.req.json();
    const orderId = `order-${orderCounter++}`;
    const eventId = `${orderId}-${Date.now()}`;
    
    // Validation basique
    if (!body.userId || !body.amount || !body.items) {
      return c.json({ error: 'Missing required fields: userId, amount, items' }, 400);
    }

    // Vérifier déduplication
    if (deduplicator.isDuplicate(eventId)) {
      console.log(`⚠️ Duplicate order creation request ignored: ${eventId}`);
      return c.json({ 
        orderId, 
        eventId,
        status: 'duplicate',
        message: 'Order already exists' 
      }, 409);
    }

    const orderEvent = {
      eventId,
      orderId,
      userId: body.userId,
      amount: body.amount,
      items: body.items,
      status: 'CREATED',
      createdAt: new Date().toISOString()
    };

    // Publier OrderCreated avec retry et backoff
    await withRetry(async (attempt) => {
      await producer.send({
        topic: 'orders.created',
        messages: [{
          key: orderId, // Clé pour partitioning
          value: JSON.stringify(orderEvent),
          headers: {
            eventId: eventId,
            eventType: 'OrderCreated',
            retryAttempt: attempt.toString()
          }
        }]
      });
      
      console.log(`📤 OrderCreated → produced: ${orderId} (eventId: ${eventId}) [attempt: ${attempt + 1}]`);
      
      // Métriques Prometheus
      kafkaMessagesProduced.inc({ topic: 'orders.created', service: 'commande' });
      ordersTotal.inc({ service: 'commande' });
      orderAmount.observe({ service: 'commande' }, body.amount);
    }, 3, backoff);
    
    return c.json({ 
      orderId, 
      eventId,
      status: 'created',
      message: 'Order created successfully' 
    }, 201);

  } catch (error) {
    console.error('❌ Error creating order:', error.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

async function startService() {
  try {
    console.log('🚀 Starting Commande Service...');
    
    await producer.connect();
    console.log('✅ Connected to Kafka');

    serve({
      fetch: app.fetch,
      port: 3001
    });

    console.log('🌐 HTTP server running on http://localhost:3001');
    console.log('📋 Ready to accept POST /orders requests');

  } catch (error) {
    console.error('❌ Error starting Commande Service:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down Commande Service...');
  
  try {
    await producer.disconnect();
    console.log('✅ Kafka disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting from Kafka:', error.message);
  }
  
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startService();