import { createAdmin } from '../services/shared/kafka.js';

const admin = createAdmin();

async function createTopics() {
  try {
    console.log('🚀 Connecting to Kafka...');
    await admin.connect();

    const topics = [
      {
        topic: 'accounts.created',
        numPartitions: 3,
        replicationFactor: 1
      },
      {
        topic: 'payments.processed', 
        numPartitions: 3,
        replicationFactor: 1
      }
    ];

    console.log('📝 Creating topics...');
    await admin.createTopics({
      topics,
      waitForLeaders: true,
      timeout: 10000
    });

    console.log('✅ Topics ready');
    console.log('   - accounts.created (3 partitions)');
    console.log('   - payments.processed (3 partitions)');

  } catch (error) {
    if (error.type === 'TOPIC_ALREADY_EXISTS') {
      console.log('✅ Topics already exist and are ready');
    } else {
      console.error('❌ Error creating topics:', error.message);
      process.exit(1);
    }
  } finally {
    await admin.disconnect();
  }
}

createTopics();