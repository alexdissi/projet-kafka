import { createConsumer, createProducer } from '../shared/kafka.js';

const consumer = createConsumer('payments-svc');
const producer = createProducer();

async function startService() {
  try {
    console.log('🚀 Starting Payments Service...');
    
    await consumer.connect();
    await producer.connect();
    console.log('✅ Connected to Kafka');

    await consumer.subscribe({ topics: ['accounts.created'] });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const accountData = JSON.parse(message.value.toString());
        const { accountId } = accountData;

        console.log(`📥 payments ⬅ consumed: ${accountId} from ${topic}`);

        await new Promise(resolve => setTimeout(resolve, 500));

        const paymentData = {
          accountId,
          status: 'PAID',
          processedAt: new Date().toISOString()
        };

        await producer.send({
          topic: 'payments.processed',
          messages: [{
            key: accountId,
            value: JSON.stringify(paymentData)
          }]
        });

        console.log(`📤 payments → produced: ${accountId} payment processed`);
      }
    });

  } catch (error) {
    console.error('❌ Error starting Payments Service:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down Payments Service...');
  
  try {
    await consumer.disconnect();
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