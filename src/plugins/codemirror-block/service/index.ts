import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

export interface CodemirrorEditLock {
  key: string;
  label?: string;
  updatedAt: number;
}

export interface CodemirrorEditLockOwner {
  id: number | string;
  lock: CodemirrorEditLock;
  name?: string;
}

export interface CodemirrorEditLockProvider {
  acquireLock: (key: string, label: string) => boolean;
  getRemoteLockOwner: (key: string) => CodemirrorEditLockOwner | null;
  releaseLock: (key: string) => void;
  subscribe: (listener: () => void) => () => void;
}

export interface ICodemirrorEditLockService {
  acquireLock: (key: string, label: string) => boolean;
  getRemoteLockOwner: (key: string) => CodemirrorEditLockOwner | null;
  registerProvider: (provider: CodemirrorEditLockProvider) => () => void;
  releaseLock: (key: string) => void;
  subscribe: (listener: () => void) => () => void;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const ICodemirrorEditLockService: IServiceID<ICodemirrorEditLockService> =
  genServiceId<ICodemirrorEditLockService>('CodemirrorEditLockService');

export class CodemirrorEditLockService implements ICodemirrorEditLockService {
  private providerUnsubscribers = new Map<CodemirrorEditLockProvider, () => void>();
  private providers = new Set<CodemirrorEditLockProvider>();
  private subscribers = new Set<() => void>();

  acquireLock(key: string, label: string): boolean {
    if (this.getRemoteLockOwner(key)) {
      return false;
    }

    const acquiredProviders: CodemirrorEditLockProvider[] = [];

    for (const provider of this.providers) {
      if (!provider.acquireLock(key, label)) {
        acquiredProviders.forEach((acquiredProvider) => acquiredProvider.releaseLock(key));
        this.notify();
        return false;
      }

      acquiredProviders.push(provider);
    }

    this.notify();
    return true;
  }

  getRemoteLockOwner(key: string): CodemirrorEditLockOwner | null {
    for (const provider of this.providers) {
      const owner = provider.getRemoteLockOwner(key);

      if (owner) {
        return owner;
      }
    }

    return null;
  }

  registerProvider(provider: CodemirrorEditLockProvider): () => void {
    this.providers.add(provider);
    this.providerUnsubscribers.set(
      provider,
      provider.subscribe(() => this.notify()),
    );
    this.notify();

    return () => {
      this.providerUnsubscribers.get(provider)?.();
      this.providerUnsubscribers.delete(provider);
      this.providers.delete(provider);
      this.notify();
    };
  }

  releaseLock(key: string): void {
    this.providers.forEach((provider) => provider.releaseLock(key));
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    listener();

    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }
}
