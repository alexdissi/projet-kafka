import { createAdmin } from '../services/shared/kafka.js';

const admin = createAdmin();

async function createTopics() {
  try {
    console.log('🚀 Connecting to Kafka...');
    await admin.connect();

    const topics = [
      {
        topic: 'orders.created',
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'segment.ms', value: '86400000' } // 1 day
        ]
      },
      {
        topic: 'payments.authorized', 
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' }
        ]
      },
      {
        topic: 'payments.rejected', 
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' }
        ]
      },
      {
        topic: 'orders.dlq',
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '2592000000' } // 30 days pour DLQ
        ]
      },
      {
        topic: 'payments.dlq',
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '2592000000' }
        ]
      }
    ];

    console.log('📝 Creating topics with partitioned configuration...');
    await admin.createTopics({
      topics,
      waitForLeaders: true,
      timeout: 15000
    });

    console.log('✅ Topics ready');
    console.log('   - orders.created (3 partitions)');
    console.log('   - payments.authorized (3 partitions)');
    console.log('   - payments.rejected (3 partitions)');
    console.log('   - orders.dlq (3 partitions) - DLQ');
    console.log('   - payments.dlq (3 partitions) - DLQ');

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