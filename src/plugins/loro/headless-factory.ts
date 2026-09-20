import type { LoroDoc } from 'loro-crdt';

import type { LoroHeadlessFactory } from '@/headless/collaboration/loro-factory';

import type { LoroLexicalBinding, LoroPluginOptions, LoroTransportProviderOptions } from './index';
import { LoroCanonicalDocument, LoroPlugin, LoroWebSocketProvider } from './index';
import type { LoroBindingDescriptor } from './types';

/** Runtime factory exported only from the opt-in Loro headless entry. */
export const createLoroHeadlessFactory = (): LoroHeadlessFactory => ({
  create: ({ descriptor, doc, roomId, transport, transportOptions }) => {
    const canonical = new LoroCanonicalDocument(
      doc as LoroDoc | undefined,
      descriptor as LoroBindingDescriptor,
      { initialize: false },
    );
    const options = transportOptions as
      Omit<LoroTransportProviderOptions, 'applyRemoteUpdate'> | undefined;
    const transportFactory: LoroPluginOptions['transportFactory'] =
      transport || !options
        ? undefined
        : (factoryCanonical: LoroCanonicalDocument, binding: LoroLexicalBinding) =>
            new LoroWebSocketProvider(
              factoryCanonical,
              descriptor as LoroBindingDescriptor,
              roomId,
              {
                ...options,
                applyRemoteUpdate: (update) => binding.applyUpdate(update, { trusted: true }),
              },
            );

    return {
      canonical,
      plugin: [
        LoroPlugin,
        {
          descriptor: descriptor as LoroBindingDescriptor,
          doc: canonical,
          shouldBootstrap: false,
          transport,
          transportFactory,
        },
      ],
    };
  },
});
