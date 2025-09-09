import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { GenericContainer, Wait } from 'testcontainers';
import { Kafka } from 'kafkajs';
import request from 'supertest';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

// Import des services
import { createProducer, createConsumer, createAdmin } from '../services/shared/kafka.js';

describe('Kafka Microservices Integration Tests', () => {
  let kafkaContainer;
  let kafka;
  let admin;
  let producer;
  let consumer;
  let app;
  let server;

  beforeAll(async () => {
    console.log('🐳 Starting Kafka container...');
    
    // Démarrer Kafka avec Testcontainers
    kafkaContainer = await new GenericContainer('confluentinc/cp-kafka:7.4.0')
      .withEnvironment({
        KAFKA_BROKER_ID: '1',
        KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181',
        KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9093',
        KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
        KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
      })
      .withExposedPorts(9093)
      .withWaitStrategy(Wait.forLogMessage('started (kafka.server.KafkaServer)'))
      .start();

    const kafkaPort = kafkaContainer.getMappedPort(9093);
    const kafkaBroker = `localhost:${kafkaPort}`;

    console.log(`✅ Kafka started on ${kafkaBroker}`);

    // Créer les clients Kafka
    kafka = new Kafka({
      clientId: 'test-client',
      brokers: [kafkaBroker],
      retry: {
        initialRetryTime: 100,
        retries: 3
      }
    });

    admin = kafka.admin();
    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: 'test-group' });

    await admin.connect();
    await producer.connect();
    await consumer.connect();

    // Créer les topics de test
    await admin.createTopics({
      topics: [
        { topic: 'orders.created', numPartitions: 1 },
        { topic: 'payments.authorized', numPartitions: 1 },
        { topic: 'payments.rejected', numPartitions: 1 }
      ]
    });

    console.log('✅ Test topics created');

  }, 120000); // 2 minutes timeout

  afterAll(async () => {
    if (consumer) await consumer.disconnect();
    if (producer) await producer.disconnect();
    if (admin) await admin.disconnect();
    if (kafkaContainer) await kafkaContainer.stop();
    console.log('✅ Test cleanup completed');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Should create order and trigger payment flow', async () => {
    console.log('🧪 Testing end-to-end order creation and payment flow...');

    // Écouter les messages de payment
    let paymentMessages = [];
    await consumer.subscribe({ topics: ['payments.authorized', 'payments.rejected'] });
    
    const paymentPromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, message }) => {
          const data = JSON.parse(message.value.toString());
          paymentMessages.push({ topic, data });
          console.log(`📥 Test received: ${topic} for order ${data.orderId}`);
          resolve();
        }
      });
    });

    // Simuler la création d'un ordre
    const orderEvent = {
      eventId: `test-order-${Date.now()}`,
      orderId: 'test-order-123',
      userId: 'user-test',
      amount: 100.50,
      items: ['item1', 'item2'],
      status: 'CREATED',
      createdAt: new Date().toISOString()
    };

    // Publier OrderCreated
    await producer.send({
      topic: 'orders.created',
      messages: [{
        key: orderEvent.orderId,
        value: JSON.stringify(orderEvent),
        headers: {
          eventId: orderEvent.eventId,
          eventType: 'OrderCreated'
        }
      }]
    });

    console.log(`📤 Published OrderCreated: ${orderEvent.orderId}`);

    // Attendre le traitement du paiement
    await paymentPromise;

    // Vérifications
    expect(paymentMessages).toHaveLength(1);
    expect(paymentMessages[0].data.orderId).toBe('test-order-123');
    expect(['payments.authorized', 'payments.rejected']).toContain(paymentMessages[0].topic);
    expect(paymentMessages[0].data).toHaveProperty('userId', 'user-test');
    expect(paymentMessages[0].data).toHaveProperty('amount', 100.50);

    console.log('✅ End-to-end flow test completed');
  }, 30000);

  test('Should handle message deduplication', async () => {
    console.log('🧪 Testing message deduplication...');

    const orderEvent = {
      eventId: `duplicate-test-${Date.now()}`,
      orderId: 'duplicate-order-123',
      userId: 'user-test',
      amount: 50.00,
      items: ['item1'],
      status: 'CREATED',
      createdAt: new Date().toISOString()
    };

    let messageCount = 0;
    await consumer.subscribe({ topics: ['payments.authorized', 'payments.rejected'] });
    
    const duplicatePromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, message }) => {
          const data = JSON.parse(message.value.toString());
          if (data.orderId === 'duplicate-order-123') {
            messageCount++;
            console.log(`📥 Test received duplicate: ${data.orderId} (count: ${messageCount})`);
            
            // Attendre un peu pour voir si d'autres messages arrivent
            setTimeout(resolve, 2000);
          }
        }
      });
    });

    // Publier le même message deux fois
    for (let i = 0; i < 2; i++) {
      await producer.send({
        topic: 'orders.created',
        messages: [{
          key: orderEvent.orderId,
          value: JSON.stringify(orderEvent),
          headers: {
            eventId: orderEvent.eventId, // Même eventId pour tester la déduplication
            eventType: 'OrderCreated'
          }
        }]
      });
      console.log(`📤 Published duplicate ${i + 1}: ${orderEvent.orderId}`);
    }

    await duplicatePromise;

    // Vérifier qu'un seul message de paiement a été traité
    expect(messageCount).toBe(1);
    console.log('✅ Deduplication test completed');
  }, 20000);

  test('Should validate message structure and partitioning', async () => {
    console.log('🧪 Testing message structure and partitioning...');

    const orderEvent = {
      eventId: `structure-test-${Date.now()}`,
      orderId: 'structure-order-123',
      userId: 'user-test',
      amount: 25.99,
      items: ['item1'],
      status: 'CREATED',
      createdAt: new Date().toISOString()
    };

    let capturedMessage;
    await consumer.subscribe({ topics: ['payments.authorized', 'payments.rejected'] });
    
    const structurePromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const data = JSON.parse(message.value.toString());
          if (data.orderId === 'structure-order-123') {
            capturedMessage = { topic, partition, data, headers: message.headers };
            console.log(`📥 Test captured structured message: ${data.orderId}`);
            resolve();
          }
        }
      });
    });

    await producer.send({
      topic: 'orders.created',
      messages: [{
        key: orderEvent.orderId, // Important pour partitioning
        value: JSON.stringify(orderEvent),
        headers: {
          eventId: orderEvent.eventId,
          eventType: 'OrderCreated'
        }
      }]
    });

    await structurePromise;

    // Vérifications de structure
    expect(capturedMessage.data).toHaveProperty('eventId');
    expect(capturedMessage.data).toHaveProperty('orderId', 'structure-order-123');
    expect(capturedMessage.data).toHaveProperty('userId', 'user-test');
    expect(capturedMessage.data).toHaveProperty('amount');
    expect(capturedMessage.data).toHaveProperty('status');
    expect(capturedMessage.headers).toHaveProperty('eventType');
    expect(capturedMessage.headers).toHaveProperty('eventId');
    
    console.log('✅ Message structure test completed');
  }, 15000);
});