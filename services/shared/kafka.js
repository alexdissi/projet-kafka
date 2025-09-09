import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const CLIENT_ID = process.env.CLIENT_ID || 'banking-app';

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: [KAFKA_BROKERS],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

export function createProducer() {
  return kafka.producer({
    // Configuration pour idempotence et résilience
    maxInFlightRequests: 1,
    idempotent: true,
    transactionTimeout: 30000,
    // Paramètres requis pour la résilience
    acks: 'all', // acks=all pour durabilité
    retries: 5,
    retry: {
      initialRetryTime: 100,
      retries: 5,
      maxRetryTime: 30000
    }
  });
}

export function createConsumer(groupId) {
  return kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    // Configuration pour commit après traitement
    allowAutoTopicCreation: false,
    maxWaitTimeInMs: 5000,
    retry: {
      initialRetryTime: 100,
      retries: 8
    }
  });
}

export function createAdmin() {
  return kafka.admin();
}

export { kafka };