import { createProducer } from './kafka.js';

const dlqProducer = createProducer();
let isConnected = false;

export async function initDLQ() {
  if (!isConnected) {
    await dlqProducer.connect();
    isConnected = true;
    console.log('✅ DLQ Producer connected');
  }
}

export async function sendToDLQ(originalMessage, error, serviceName, dlqTopic) {
  try {
    await initDLQ();

    const dlqMessage = {
      originalTopic: originalMessage.topic,
      originalPartition: originalMessage.partition,
      originalOffset: originalMessage.offset,
      originalKey: originalMessage.key?.toString(),
      originalValue: originalMessage.value?.toString(),
      originalHeaders: Object.entries(originalMessage.headers || {}).reduce((acc, [key, value]) => {
        acc[key] = value?.toString();
        return acc;
      }, {}),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      serviceName,
      dlqTimestamp: new Date().toISOString(),
      retryCount: (originalMessage.headers?.retryCount ? parseInt(originalMessage.headers.retryCount.toString()) : 0) + 1
    };

    await dlqProducer.send({
      topic: dlqTopic,
      messages: [{
        key: originalMessage.key,
        value: JSON.stringify(dlqMessage),
        headers: {
          ...originalMessage.headers,
          dlqReason: error.message,
          dlqService: serviceName,
          dlqTimestamp: dlqMessage.dlqTimestamp,
          retryCount: dlqMessage.retryCount.toString()
        }
      }]
    });

    console.log(`💀 DLQ → Message sent to ${dlqTopic}: ${error.message}`);

  } catch (dlqError) {
    console.error('❌ Failed to send message to DLQ:', dlqError.message);
    throw dlqError; // Re-throw pour que le consumer original puisse décider quoi faire
  }
}

export async function disconnectDLQ() {
  if (isConnected) {
    await dlqProducer.disconnect();
    isConnected = false;
    console.log('✅ DLQ Producer disconnected');
  }
}