export const DEFAULT_SESSION_RETENTION_LIMIT = 256;

/**
 * A bounded retention table for session identities.
 *
 * Entries are deliberately never evicted. Evicting a terminal session would
 * allow a delayed retry to look like a new transaction and could duplicate a
 * document rewrite. Callers must fail closed when the table is full and rotate
 * the facade (or explicitly clear it during teardown) before admitting more
 * unique session IDs.
 */
export class BoundedSessionRetention<T> {
  private readonly entries = new Map<string, T>();
  private readonly reservations = new Set<string>();

  constructor(readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error('Session retention limit must be a positive safe integer.');
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): T | undefined {
    return this.entries.get(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** Reserve a slot before a caller performs an irreversible document write. */
  reserve(key: string): boolean {
    if (this.entries.has(key) || this.reservations.has(key)) return false;
    if (this.entries.size + this.reservations.size >= this.limit) return false;
    this.reservations.add(key);
    return true;
  }

  /** Publish a value for a previously reserved or already admitted key. */
  commit(key: string, value: T): boolean {
    const wasReserved = this.reservations.delete(key);
    // A new key must have a reservation. This prevents a caller that performs
    // an asynchronous mutation from bypassing the capacity check, including
    // after clear() during teardown.
    if (!wasReserved && !this.entries.has(key)) return false;
    this.entries.set(key, value);
    return true;
  }

  release(key: string): void {
    this.reservations.delete(key);
  }

  values(): IterableIterator<T> {
    return this.entries.values();
  }

  clear(): void {
    this.entries.clear();
    this.reservations.clear();
  }
}
