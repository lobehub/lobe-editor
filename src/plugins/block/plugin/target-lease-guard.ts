import type { LexicalEditor } from 'lexical';
import { $getNodeByKey } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import { $resolveLogicalBlockNode } from '@/plugins/common/node/hole';
import { $getNodeId } from '@/plugins/properties/utils';

import {
  type CollaborativeTargetLeaseCapability,
  ICollaborativeTargetLeaseService,
} from '../service/target-lease';

const LOCKED_ATTRIBUTE = 'data-collaborative-target-locked';
const OWNER_ATTRIBUTE = 'data-collaborative-target-owner';
const REQUEST_ATTRIBUTE = 'data-collaborative-target-request';

const getEventCapability = (event: Event): CollaborativeTargetLeaseCapability | null => {
  if (
    event.type === 'pointerdown' ||
    event.type === 'click' ||
    event.type === 'focusin' ||
    event.type === 'selectstart'
  ) {
    return 'select';
  }
  if (event.type === 'paste') return 'edit';
  if (event.type === 'cut') return 'delete';
  if (event.type === 'dragstart' || event.type === 'drop') return 'move';
  if (event.type === 'beforeinput') {
    const inputType = (event as InputEvent).inputType;
    return inputType?.startsWith('delete') ? 'delete' : 'edit';
  }
  if (event.type === 'keydown') {
    const keyboardEvent = event as KeyboardEvent;
    if (
      (keyboardEvent.metaKey || keyboardEvent.ctrlKey) &&
      keyboardEvent.key.toLowerCase() === 'c'
    ) {
      return null;
    }
    if (/^(Backspace|Delete)$/u.test(keyboardEvent.key)) return 'delete';
    if (/^(Arrow|Home|End|Page)/u.test(keyboardEvent.key)) return 'select';
    return 'edit';
  }
  return null;
};

const getBlockElement = (event: Event, root: HTMLElement): HTMLElement | null => {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>('[data-block-id]');
  return element && root.contains(element) ? element : null;
};

const getLogicalNodeId = (editor: LexicalEditor, blockElement: HTMLElement): string | undefined => {
  const blockKey = blockElement.dataset.blockId;
  if (!blockKey) return undefined;
  let nodeId: string | undefined;
  editor.getEditorState().read(() => {
    const node = $getNodeByKey(blockKey);
    const logicalNode = node ? $resolveLogicalBlockNode(node) : null;
    nodeId = logicalNode ? $getNodeId(logicalNode) : undefined;
  });
  return nodeId;
};

/** Install the non-CSS interaction guard for active adapter-owned leases. */
export const registerTargetLeaseGuards = (editor: LexicalEditor): (() => void) => {
  const kernel = getKernelFromEditor(editor);
  const service = kernel?.requireService(ICollaborativeTargetLeaseService);
  if (!service) return () => {};

  let activeRoot: HTMLElement | null = null;
  let cleanupRoot = (): void => {};
  let observer: MutationObserver | null = null;

  const refreshMarkers = (): void => {
    const root = activeRoot;
    if (!root) return;
    const elements = root.querySelectorAll<HTMLElement>('[data-block-id]');
    for (const element of elements) {
      const nodeId = getLogicalNodeId(editor, element);
      const lease = nodeId ? service.getLease({ nodeId, targetKind: 'node' }) : null;
      if (!lease) {
        element.removeAttribute(LOCKED_ATTRIBUTE);
        element.removeAttribute(OWNER_ATTRIBUTE);
        element.removeAttribute(REQUEST_ATTRIBUTE);
        continue;
      }
      element.setAttribute(LOCKED_ATTRIBUTE, 'true');
      element.setAttribute(OWNER_ATTRIBUTE, lease.ownerLabel || lease.ownerId);
      element.setAttribute(REQUEST_ATTRIBUTE, lease.requestId);
    }
  };

  const installRoot = (root: HTMLElement | null): void => {
    cleanupRoot();
    observer?.disconnect();
    observer = null;
    activeRoot = root;
    cleanupRoot = () => {};
    if (!root) return;

    const blockInteractionGuard = (event: Event): void => {
      const capability = getEventCapability(event);
      if (!capability) return;
      const blockElement = getBlockElement(event, root);
      if (!blockElement) return;
      const nodeId = getLogicalNodeId(editor, blockElement);
      if (!nodeId || service.can({ nodeId, targetKind: 'node' }, capability)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const eventTypes = [
      'beforeinput',
      'click',
      'dragstart',
      'drop',
      'focusin',
      'keydown',
      'paste',
      'cut',
      'pointerdown',
      'selectstart',
    ] as const;
    eventTypes.forEach((type) => root.addEventListener(type, blockInteractionGuard, true));
    cleanupRoot = () => {
      eventTypes.forEach((type) => root.removeEventListener(type, blockInteractionGuard, true));
      root.querySelectorAll<HTMLElement>(`[${LOCKED_ATTRIBUTE}]`).forEach((element) => {
        element.removeAttribute(LOCKED_ATTRIBUTE);
        element.removeAttribute(OWNER_ATTRIBUTE);
        element.removeAttribute(REQUEST_ATTRIBUTE);
      });
    };
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(refreshMarkers);
      observer.observe(root, { childList: true, subtree: true });
    }
  };

  let unregisterRootListener = (): void => {};
  try {
    unregisterRootListener = editor.registerRootListener((root) => {
      installRoot(root);
      refreshMarkers();
    });
  } catch {
    // Lexical's headless adapter throws for DOM-only root listeners. The
    // service remains available to command/menu gates in that environment.
  }
  try {
    if (!activeRoot) installRoot(editor.getRootElement());
  } catch {
    // `getRootElement` is unavailable on some headless adapters.
  }

  const unsubscribeLease = service.subscribe(refreshMarkers);
  const unregisterEditorUpdate = editor.registerUpdateListener(refreshMarkers);
  refreshMarkers();

  return () => {
    unsubscribeLease();
    unregisterEditorUpdate();
    unregisterRootListener();
    observer?.disconnect();
    cleanupRoot();
    activeRoot = null;
  };
};
