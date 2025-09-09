import { createConsumer } from '../shared/kafka.js';

const consumer = createConsumer('notifications-svc');

async function startService() {
  try {
    console.log('🚀 Starting Notifications Service...');
    
    await consumer.connect();
    console.log('✅ Connected to Kafka');

    await consumer.subscribe({ topics: ['payments.processed'] });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const paymentData = JSON.parse(message.value.toString());
        const { accountId, status, processedAt } = paymentData;

        console.log(`📥 notifications ⬅ consumed: ${accountId} from ${topic}`);
        console.log(`🔔 NOTIFICATION: Account ${accountId} payment ${status} at ${processedAt}`);
      }
    });

  } catch (error) {
    console.error('❌ Error starting Notifications Service:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down Notifications Service...');
  
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