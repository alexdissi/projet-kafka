import { describe, test, expect, beforeEach } from '@jest/globals';
import { EventDeduplicator, ExponentialBackoff, withRetry } from '../services/shared/resilience.js';

describe('Resilience Utils Unit Tests', () => {
  
  describe('EventDeduplicator', () => {
    let deduplicator;

    beforeEach(() => {
      deduplicator = new EventDeduplicator(100, 1000); // maxSize=100, ttl=1s pour tests
    });

    test('should detect duplicates', () => {
      const eventId = 'test-event-123';
      
      expect(deduplicator.isDuplicate(eventId)).toBe(false); // Premier appel
      expect(deduplicator.isDuplicate(eventId)).toBe(true);  // Duplicate
      expect(deduplicator.size()).toBe(1);
    });

    test('should handle null/undefined eventIds', () => {
      expect(deduplicator.isDuplicate(null)).toBe(false);
      expect(deduplicator.isDuplicate(undefined)).toBe(false);
      expect(deduplicator.isDuplicate('')).toBe(false);
    });

    test('should expire old entries', async () => {
      const eventId = 'expire-test';
      
      expect(deduplicator.isDuplicate(eventId)).toBe(false);
      expect(deduplicator.size()).toBe(1);
      
      // Attendre expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Nouveau eventId pour trigger le cleanup
      expect(deduplicator.isDuplicate('new-event')).toBe(false);
      expect(deduplicator.size()).toBe(1); // L'ancien a expiré
    });

    test('should respect maxSize limit', () => {
      const smallDeduplicator = new EventDeduplicator(2, 60000);
      
      smallDeduplicator.isDuplicate('event1');
      smallDeduplicator.isDuplicate('event2');
      smallDeduplicator.isDuplicate('event3'); // Devrait virer event1
      
      expect(smallDeduplicator.size()).toBe(2);
      expect(smallDeduplicator.isDuplicate('event1')).toBe(false); // Plus dans cache
      expect(smallDeduplicator.isDuplicate('event2')).toBe(true);  // Encore dans cache
    });
  });

  describe('ExponentialBackoff', () => {
    test('should calculate correct delays', () => {
      const backoff = new ExponentialBackoff(100, 5000, 2);
      
      expect(backoff.calculateDelay(0)).toBe(100);    // 100 * 2^0 = 100
      expect(backoff.calculateDelay(1)).toBe(200);    // 100 * 2^1 = 200
      expect(backoff.calculateDelay(2)).toBe(400);    // 100 * 2^2 = 400
      expect(backoff.calculateDelay(3)).toBe(800);    // 100 * 2^3 = 800
      expect(backoff.calculateDelay(10)).toBe(5000);  // Capped at maxDelay
    });

    test('should wait for calculated time', async () => {
      const backoff = new ExponentialBackoff(10, 1000, 2); // 10ms initial
      
      const start = Date.now();
      await backoff.wait(0); // Should wait ~10ms
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(8); // Un peu de tolérance
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('withRetry', () => {
    test('should succeed on first attempt', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return 'success';
      };

      const result = await withRetry(operation, 3);
      
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return 'success';
      };

      const backoff = new ExponentialBackoff(1, 100, 2); // Fast backoff pour tests
      const result = await withRetry(operation, 3, backoff);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should fail after max retries', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error(`Attempt ${attempts} failed`);
      };

      const backoff = new ExponentialBackoff(1, 10, 2);
      
      await expect(withRetry(operation, 2, backoff))
        .rejects.toThrow('Attempt 3 failed');
      
      expect(attempts).toBe(3); // 1 initial + 2 retries
    });

    test('should pass attempt number to operation', async () => {
      const attemptNumbers = [];
      const operation = async (attempt) => {
        attemptNumbers.push(attempt);
        if (attempt < 2) {
          throw new Error('Not yet');
        }
        return 'done';
      };

      const backoff = new ExponentialBackoff(1, 10, 2);
      await withRetry(operation, 3, backoff);
      
      expect(attemptNumbers).toEqual([0, 1, 2]);
    });
  });
});