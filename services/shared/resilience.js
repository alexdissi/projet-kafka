export class ExponentialBackoff {
  constructor(initialDelayMs = 100, maxDelayMs = 30000, multiplier = 2) {
    this.initialDelay = initialDelayMs;
    this.maxDelay = maxDelayMs;
    this.multiplier = multiplier;
  }

  calculateDelay(attempt) {
    const delay = this.initialDelay * Math.pow(this.multiplier, attempt);
    return Math.min(delay, this.maxDelay);
  }

  async wait(attempt) {
    const delay = this.calculateDelay(attempt);
    console.log(`⏳ Exponential backoff: waiting ${delay}ms (attempt ${attempt + 1})`);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

export class EventDeduplicator {
  constructor(maxSize = 10000, ttlMs = 3600000) { // 1 hour TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  isDuplicate(eventId) {
    if (!eventId) return false;

    const now = Date.now();
    
    // Nettoyer les entrées expirées
    for (const [key, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }

    if (this.cache.has(eventId)) {
      return true; // Duplicate détecté
    }

    // Ajouter l'eventId au cache
    this.cache.set(eventId, now);

    // Nettoyer si la cache devient trop grande (LRU basique)
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    return false;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

export async function withRetry(operation, maxRetries = 3, backoff = new ExponentialBackoff()) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation(attempt);
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        console.log(`🔄 Operation failed, retrying... (${attempt + 1}/${maxRetries}): ${error.message}`);
        await backoff.wait(attempt);
      }
    }
  }
  
  console.error(`❌ Operation failed after ${maxRetries + 1} attempts`);
  throw lastError;
}