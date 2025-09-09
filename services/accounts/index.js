import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createProducer } from '../shared/kafka.js';

const app = new Hono();
const producer = createProducer();

let accountCounter = 1;
let intervalId;

app.get('/', (c) => {
  return c.text('hello world');
});

async function startService() {
  try {
    console.log('🚀 Starting Accounts Service...');
    
    await producer.connect();
    console.log('✅ Connected to Kafka');

    intervalId = setInterval(async () => {
      const accountId = `account-${accountCounter++}`;
      const userId = `user-${Math.floor(Math.random() * 1000)}`;
      
      const message = {
        accountId,
        userId,
        createdAt: new Date().toISOString()
      };

      await producer.send({
        topic: 'accounts.created',
        messages: [{
          key: accountId,
          value: JSON.stringify(message)
        }]
      });

      console.log(`📤 accounts → produced: ${accountId}`);
    }, 3000);

    serve({
      fetch: app.fetch,
      port: 3001
    });

    console.log('🌐 HTTP server running on http://localhost:3001');
    console.log('📤 Publishing accounts.created events every 3s...');

  } catch (error) {
    console.error('❌ Error starting Accounts Service:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down Accounts Service...');
  
  if (intervalId) {
    clearInterval(intervalId);
  }
  
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