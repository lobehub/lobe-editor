import type { CollaborationDescriptor, CollaborationTransportPort } from '@/common/collaboration';
import type { IPlugin } from '@/types';

/**
 * The synchronous headless facade accepts this factory instead of importing
 * the Loro runtime itself.  Keeping the factory at the option boundary lets
 * the default Yjs/headless entry remain free of the browser WASM dependency.
 */
export interface LoroHeadlessFactoryOptions {
  descriptor: CollaborationDescriptor;
  doc?: unknown;
  roomId: string;
  transport?: CollaborationTransportPort;
  transportOptions?: unknown;
}

export interface LoroHeadlessFactoryResult {
  canonical: {
    doc: {
      free: () => void;
    };
  };
  plugin: IPlugin;
}

export interface LoroHeadlessFactory {
  create(options: LoroHeadlessFactoryOptions): LoroHeadlessFactoryResult;
}
