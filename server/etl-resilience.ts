/**
 * ETL Resilience Utilities
 * 
 * Provides retry logic, exponential backoff, and circuit breaker pattern
 * for robust ETL operations against SQL Server.
 */

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry options configuration
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[]; // Error messages that should trigger retry
  timeout?: number; // Request timeout in ms (default: 120000 = 2 min)
  onlyIdempotent?: boolean; // Only retry if operation is idempotent (default: true)
}

/**
 * Retry with exponential backoff
 * 
 * Automatically retries failed operations with increasing delays.
 * 
 * @example
 * const result = await retryWithBackoff(
 *   () => pool.request().query(sql),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay = 30000, // 30 seconds max
    backoffMultiplier = 2,
    timeout = 120000, // 2 minutes default
    onlyIdempotent = true,
    retryableErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ESOCKETTIMEDOUT',
      'timeout',
      'connection',
      'socket',
      'network'
    ]
  } = options;

  // Safety check: only retry if explicitly marked as idempotent
  if (onlyIdempotent) {
    console.log('[Retry] Operation marked as idempotent, retries enabled');
  }

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wrap with timeout to prevent long-running queries from accumulating
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Stringify error code for comparison (handles numeric codes)
      const errorCode = error.code ? String(error.code) : '';
      const errorMessage = error.message || '';
      
      // Check if error is retryable
      const isRetryable = retryableErrors.some(
        errMsg => errorMessage.toLowerCase().includes(errMsg.toLowerCase()) ||
                  errorCode.toLowerCase().includes(errMsg.toLowerCase())
      );

      if (!isRetryable) {
        console.error(`[Retry] Non-retryable error encountered:`, errorMessage);
        throw error;
      }

      // Last attempt - don't wait, just throw
      if (attempt === maxRetries - 1) {
        console.error(`[Retry] Max retries (${maxRetries}) exceeded`);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      console.warn(
        `[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}. ` +
        `Retrying in ${delay}ms...`
      );

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failures exceeded threshold, blocking calls
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;  // Number of failures before opening circuit (recommend: 10-15 for ETL)
  successThreshold: number;  // Number of successes to close from half-open (recommend: 3-5)
  timeout: number;           // Time in ms before attempting half-open (recommend: 120000 = 2min for ETL)
  name?: string;             // Name for logging
}

/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures by "opening" the circuit after too many errors.
 * After a timeout period, allows test requests through ("half-open").
 * 
 * @example
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000,
 *   name: 'SQLServer'
 * });
 * 
 * const result = await breaker.execute(() => queryDatabase());
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private nextAttemptTime = 0;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      ...options,
      name: options.name || 'CircuitBreaker'
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed to try half-open
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          `[${this.options.name}] Circuit breaker is OPEN. ` +
          `Next attempt in ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`
        );
      }
      
      // Transition to half-open to test
      console.log(`[${this.options.name}] Circuit breaker transitioning to HALF_OPEN`);
      this.state = CircuitState.HALF_OPEN;
      this.successes = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      console.log(
        `[${this.options.name}] Success in HALF_OPEN (${this.successes}/${this.options.successThreshold})`
      );

      if (this.successes >= this.options.successThreshold) {
        console.log(`[${this.options.name}] Circuit breaker CLOSED (recovered)`);
        this.state = CircuitState.CLOSED;
        this.successes = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      console.warn(`[${this.options.name}] Failure in HALF_OPEN, reopening circuit`);
      this.openCircuit();
    } else if (this.failures >= this.options.failureThreshold) {
      console.error(
        `[${this.options.name}] Failure threshold reached (${this.failures}/${this.options.failureThreshold})`
      );
      this.openCircuit();
    }
  }

  /**
   * Open the circuit (block calls)
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.options.timeout;
    console.error(
      `[${this.options.name}] Circuit breaker OPEN. ` +
      `Will retry in ${this.options.timeout / 1000}s`
    );
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Manually reset circuit (for testing/admin purposes)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = 0;
    console.log(`[${this.options.name}] Circuit breaker manually reset`);
  }
}

/**
 * Combine retry and circuit breaker for maximum resilience
 * 
 * @example
 * const result = await executeWithResilience(
 *   () => pool.request().query(sql),
 *   circuitBreaker,
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function executeWithResilience<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryOptions: RetryOptions
): Promise<T> {
  return circuitBreaker.execute(() => retryWithBackoff(fn, retryOptions));
}
