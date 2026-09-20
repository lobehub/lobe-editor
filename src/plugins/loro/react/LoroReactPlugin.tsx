'use client';

import {
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';
import type { FC } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { type CollaborationReadiness, ICollaborationService } from '@/common/collaboration';
import { useLexicalComposerContext } from '@/editor-kernel/react';
import { $getNodeId } from '@/plugins/properties';

import { LoroPlugin, type LoroPluginOptions } from '../plugin';
import { getFlowOffset } from '../text-flow';

export interface LoroReactPluginProps extends LoroPluginOptions {
  presenceEnabled?: boolean;
  presenceState?: Readonly<Record<string, unknown>>;
  onReadinessChange?: (readiness: CollaborationReadiness) => void;
  onStatusChange?: (status: string) => void;
  onSync?: (synced: boolean) => void;
}

/**
 * Thin lifecycle adapter for the core Loro plugin. It intentionally owns no
 * DOM/cursor rendering; presence coordinates remain descriptor-bound anchors
 * in the neutral collaboration service.
 */
export const LoroReactPlugin: FC<LoroReactPluginProps> = ({
  presenceEnabled = true,
  presenceState,
  onReadinessChange,
  onStatusChange,
  onSync,
  ...options
}) => {
  const [editor] = useLexicalComposerContext();
  const generationRef = useRef(0);
  const optionsRef = useRef<LoroPluginOptions>(options);
  optionsRef.current = options;
  const callbacksRef = useRef({ onReadinessChange, onStatusChange, onSync });
  callbacksRef.current = { onReadinessChange, onStatusChange, onSync };
  const presenceStateRef = useRef(presenceState);
  presenceStateRef.current = presenceState;
  const publishPresenceRef = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    const generation = ++generationRef.current;
    editor.registerPlugin(LoroPlugin, optionsRef.current);
    const service = editor.requireService(ICollaborationService);
    if (!service) return undefined;

    const onStatusDispose = service.transport.onStatus((status) => {
      if (generation !== generationRef.current) return;
      callbacksRef.current.onStatusChange?.(status);
    });
    const onSyncDispose = service.transport.onSync((synced) => {
      if (generation !== generationRef.current) return;
      if (synced) publishPresenceRef.current?.();
      callbacksRef.current.onSync?.(synced);
    });
    const onReadinessDispose = service.subscribeReadiness((readiness) => {
      if (generation !== generationRef.current) return;
      callbacksRef.current.onReadinessChange?.(readiness);
    });

    const publishPresence = (lexicalEditor: LexicalEditor): void => {
      if (!presenceEnabled) return;
      lexicalEditor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          service.transport.clearPresence();
          return;
        }

        const capture = (point: { key: string; offset: number }) => {
          const pointNode = $getNodeByKey(point.key);
          if (!pointNode) return null;
          let owner = pointNode.getParent();
          while (owner && (!$isElementNode(owner) || owner.isInline())) owner = owner.getParent();
          if (!owner || !$isElementNode(owner)) return null;
          const nodeId = $getNodeId(owner);
          if (!nodeId) return null;
          const offset = getFlowOffset(pointNode, point.offset, owner);
          return offset === null ? null : service.capturePoint({ nodeId, offset });
        };

        const anchor = capture(selection.anchor);
        const focus = capture(selection.focus);
        if (!anchor || !focus) {
          service.transport.clearPresence();
          return;
        }
        service.transport.setPresence({
          anchor,
          descriptor: service.descriptor,
          focus,
          state: presenceStateRef.current ?? {},
        });
      });
    };

    let disposeLexical: (() => void) | undefined;
    const bindLexical = (lexicalEditor: LexicalEditor): void => {
      disposeLexical?.();
      const publish = (): void => publishPresence(lexicalEditor);
      publishPresenceRef.current = publish;
      publish();
      disposeLexical = lexicalEditor.registerUpdateListener(publish);
    };
    const lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) bindLexical(lexicalEditor);
    else {
      const onInitialized = (next: LexicalEditor): void => bindLexical(next);
      editor.on('initialized', onInitialized);
      disposeLexical = () => editor.off('initialized', onInitialized);
    }

    return () => {
      disposeLexical?.();
      publishPresenceRef.current = undefined;
      service.transport.clearPresence();
      onStatusDispose();
      onSyncDispose();
      onReadinessDispose();
      // The Kernel owns the registered LoroPlugin and its service. React's
      // effect cleanup only releases this observer/presence subscription;
      // disposing here would leave the same Kernel plugin registered with a
      // terminated service when StrictMode or a root remount replays setup.
    };
  }, [editor, presenceEnabled]);

  return null;
};

LoroReactPlugin.displayName = 'LoroReactPlugin';

export default LoroReactPlugin;
